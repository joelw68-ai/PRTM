import React, { useState } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle2 } from 'lucide-react';

const FEEDBACK_EMAIL = 'JoelW68@gmail.com';


/**
 * BetaFeedback — Simple floating feedback button + modal.
 *
 * One textarea. One submit button. Sends email via mailto:.
 * No database. No categories. No dropdowns. No ratings.
 */
const BetaFeedback: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const subject = encodeURIComponent('Beta Feedback');
    const body = encodeURIComponent(message.trim());
    window.open(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`, '_self');

    setSent(true);
    setMessage('');

    // Reset after 4 seconds so they can send another one
    setTimeout(() => {
      setSent(false);
      setIsOpen(false);
    }, 4000);
  };

  return (
    <>
      {/* Floating Feedback Button */}
      <button
        onClick={() => { setIsOpen(true); setSent(false); }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-full shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-700 transition-all hover:scale-105"
        title="Send Beta Feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-medium">Beta Feedback</span>
      </button>

      {/* Modal */}
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
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Email opened!</h4>
                <p className="text-slate-400 text-sm">
                  Your email app should have opened with the feedback pre-filled.
                  <br />Just hit Send and you&apos;re done.
                </p>
              </div>
            ) : (
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
                  />
                </div>

                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-5 h-5" />
                  Send Feedback
                </button>

                <p className="text-xs text-slate-500 text-center">
                  Opens your email app with the feedback pre-filled — just hit Send.
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
