import React, { useState } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * BetaFeedback — Floating feedback button + modal.
 * Uses EmailJS to send feedback silently in the background.
 * NO mailto links. NO database calls. NO email app popups.
 * Just type → click Submit → green success message.
 */
const BetaFeedback: React.FC = () => {
  const { user, profile } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    const templateId = 'gmxv2es';
    const publicKey = 'n6p-J5dvdN7wk8DeO';

    // Template parameters sent to EmailJS
    const templateParams = {
      message: message.trim(),
      name: senderName,
      email: senderEmail,
    };

    try {
      // Dynamically import @emailjs/browser to send the email
      const emailjsModule = await import('@emailjs/browser');
      const emailjs = emailjsModule.default || emailjsModule;

      // Send email silently in the background via EmailJS API
      const response = await emailjs.send(serviceId, templateId, templateParams, publicKey);
      console.log('[BetaFeedback] EmailJS response:', response.status, response.text);

      // Show success
      setSent(true);
      setMessage('');

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg">
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
                  Your message has been emailed to the dev team.
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
                    rows={6}
                    placeholder="Type your issue or suggestion here..."
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors resize-none"
                    autoFocus
                    disabled={sending}
                  />
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
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit
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
