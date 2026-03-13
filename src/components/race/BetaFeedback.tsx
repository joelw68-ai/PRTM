import React, { useState } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle2, AlertCircle, Loader2, Camera, Trash2, Image } from 'lucide-react';
import emailjs from '@emailjs/browser';
import html2canvas from 'html2canvas';
import { useAuth } from '@/contexts/AuthContext';


/**
 * BetaFeedback — Floating feedback button + modal.
 * Uses EmailJS to send feedback silently in the background.
 * Includes screenshot capture via html2canvas.
 * NO mailto links. NO database calls. NO email app popups.
 * Just type → optionally capture screenshot → click Submit → green success message.
 */
const BetaFeedback: React.FC = () => {
  const { user, profile } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Screenshot state
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const handleCaptureScreenshot = async () => {
    if (capturing) return;
    setCapturing(true);
    setErrorMsg('');

    try {
      // Temporarily hide the feedback modal overlay so it doesn't appear in the screenshot
      const modalOverlay = document.getElementById('beta-feedback-overlay');
      if (modalOverlay) {
        modalOverlay.style.visibility = 'hidden';
      }

      // Small delay to let the browser repaint without the modal
      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas = await html2canvas(document.body, {
        scale: 0.5,              // Lower scale to reduce base64 size
        useCORS: true,           // Allow cross-origin images
        logging: false,
        backgroundColor: '#0f172a', // Match app dark background
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      // Convert to base64 JPEG at 60% quality to keep size manageable for EmailJS
      const base64 = canvas.toDataURL('image/jpeg', 0.6);
      setScreenshot(base64);

      // Restore modal visibility
      if (modalOverlay) {
        modalOverlay.style.visibility = 'visible';
      }

      console.log('[BetaFeedback] Screenshot captured, size:', Math.round(base64.length / 1024), 'KB');
    } catch (err: any) {
      console.error('[BetaFeedback] Screenshot capture failed:', err);
      setErrorMsg('Screenshot capture failed. You can still submit feedback without it.');

      // Restore modal visibility on error too
      const modalOverlay = document.getElementById('beta-feedback-overlay');
      if (modalOverlay) {
        modalOverlay.style.visibility = 'visible';
      }
    } finally {
      setCapturing(false);
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    setErrorMsg('');

    // Gather sender info from auth context
    const senderName =
      profile?.driverName ||
      profile?.teamName ||
      user?.email ||
      'Anonymous Beta Tester';
    const senderEmail = user?.email || 'no-account@unknown.com';

    // EmailJS credentials
    const serviceId = 'service_c4b4pie';
    const templateId = 'template_a9midap';
    const publicKey = 'n6p-J5dvdN7wk8DeO';

    // Template parameters sent to EmailJS
    const templateParams: Record<string, string> = {
      message: message.trim(),
      name: senderName,
      email: senderEmail,
    };

    // Attach screenshot as base64 if captured
    if (screenshot) {
      templateParams.screenshot = screenshot;
    }

    try {
      // Send email silently in the background via EmailJS API
      const response = await emailjs.send(serviceId, templateId, templateParams, publicKey);
      console.log('[BetaFeedback] EmailJS response:', response.status, response.text);

      // Show success
      setSent(true);
      setMessage('');
      setScreenshot(null);

      // Auto-close after 5 seconds
      setTimeout(() => {
        setSent(false);
        setIsOpen(false);
      }, 5000);
    } catch (err: any) {
      console.error('[BetaFeedback] EmailJS send failed:', err);
      setErrorMsg(
        err?.text || err?.message || 'Failed to send feedback. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Feedback Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setSent(false);
          setErrorMsg('');
        }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-full shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-700 transition-all hover:scale-105"
        title="Send Beta Feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-medium">Beta Feedback</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          id="beta-feedback-overlay"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
        >
          <div className="bg-slate-800 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <MessageSquarePlus className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Beta Feedback</h3>
                  <p className="text-xs text-slate-400">Tell us what&apos;s on your mind</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            {sent ? (
              /* ── Success State ── */
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h4 className="text-lg font-semibold text-green-400 mb-2">
                  Feedback sent! Thank you.
                </h4>
                <p className="text-slate-400 text-sm">
                  Your message{screenshot ? ' and screenshot have' : ' has'} been emailed to the dev team.
                </p>
              </div>
            ) : (
              /* ── Form State ── */
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label
                    htmlFor="beta-feedback-msg"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    Bug, suggestion, or anything else:
                  </label>
                  <textarea
                    id="beta-feedback-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Type your issue or suggestion here..."
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors resize-none"
                    autoFocus
                    disabled={sending}
                  />
                </div>

                {/* Screenshot Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-300">
                      Screenshot (optional)
                    </label>
                    {screenshot && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Captured
                      </span>
                    )}
                  </div>

                  {!screenshot ? (
                    /* Capture Button */
                    <button
                      type="button"
                      onClick={handleCaptureScreenshot}
                      disabled={capturing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 border-dashed rounded-xl text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {capturing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Capturing page...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span className="text-sm">Capture Screenshot</span>
                        </>
                      )}
                    </button>
                  ) : (
                    /* Screenshot Preview */
                    <div className="relative group">
                      <div className="rounded-xl overflow-hidden border border-slate-600 bg-slate-900">
                        <img
                          src={screenshot}
                          alt="Captured screenshot preview"
                          className="w-full h-40 object-cover object-top"
                        />
                        {/* Overlay with info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent rounded-xl" />
                        <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-xs text-slate-300">
                          <Image className="w-3 h-3" />
                          <span>
                            {Math.round(screenshot.length / 1024)} KB
                          </span>
                        </div>
                      </div>

                      {/* Action buttons over the preview */}
                      <div className="absolute top-2 right-2 flex items-center gap-1.5">
                        {/* Re-capture */}
                        <button
                          type="button"
                          onClick={handleCaptureScreenshot}
                          disabled={capturing}
                          className="p-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors"
                          title="Retake screenshot"
                        >
                          {capturing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Camera className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {/* Remove */}
                        <button
                          type="button"
                          onClick={handleRemoveScreenshot}
                          className="p-1.5 bg-slate-800/90 hover:bg-red-600/80 border border-slate-600 hover:border-red-500 rounded-lg text-slate-300 hover:text-white transition-colors"
                          title="Remove screenshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    Captures the current page so the dev team can see what you&apos;re looking at.
                  </p>
                </div>

                {/* Error message */}
                {errorMsg && (
                  <div className="flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!message.trim() || sending}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending{screenshot ? ' with screenshot...' : '...'}
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit{screenshot ? ' with Screenshot' : ''}
                    </>
                  )}
                </button>

                <p className="text-xs text-slate-500 text-center">
                  Sends directly to the dev team via email — no database involved.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default BetaFeedback;
