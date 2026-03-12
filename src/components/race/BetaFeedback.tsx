import React, { useState } from 'react';
import { submitBetaFeedback } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MessageSquarePlus, X, Bug, Lightbulb, MessageCircle, 
  Send, Loader2, CheckCircle2, AlertTriangle, Star
} from 'lucide-react';

type FeedbackCategory = 'bug' | 'feature' | 'general';

interface BetaFeedbackProps {
  currentPage?: string;
}

/**
 * BetaFeedback — Floating feedback button + modal.
 *
 * COLUMN MAPPING (app field → DB column):
 *   category    → category       (was already correct)
 *   title       → title          (NEW — was missing before; maps to "subject" concept)
 *   description → description    (was already correct; maps to "message" concept)
 *   severity    → priority       (was incorrectly sent as "severity" / "rating")
 *   status      → status         (was already correct)
 *
 * STRIPPED — these columns do NOT exist in beta_feedback:
 *   feedback_type, subject, message, rating, severity,
 *   user_email, user_name, page_context
 */
const BetaFeedback: React.FC<BetaFeedbackProps> = ({ currentPage }) => {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const categoryConfig = {
    bug: { icon: Bug, label: 'Bug Report', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', description: 'Something isn\'t working correctly' },
    feature: { icon: Lightbulb, label: 'Feature Request', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30', description: 'Suggest a new feature or improvement' },
    general: { icon: MessageCircle, label: 'General Feedback', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30', description: 'Share your thoughts or experience' }
  };

  // Map the 1-5 star severity to the DB `priority` column values
  const severityToPriority = (level: number): string => {
    switch (level) {
      case 1: return 'Low';
      case 2: return 'Minor';
      case 3: return 'Medium';
      case 4: return 'High';
      case 5: return 'Critical';
      default: return 'Medium';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Build a title if the user left it blank — use category + truncated description
      const effectiveTitle = title.trim()
        || `${categoryConfig[category].label}: ${description.trim().slice(0, 60)}${description.trim().length > 60 ? '...' : ''}`;

      // Use the centralized submitBetaFeedback from database.ts
      // This sends ONLY: user_id, category, title, description, status, priority
      // It does NOT send: feedback_type, subject, message, rating, severity,
      //                    user_email, user_name, page_context
      await submitBetaFeedback({
        category,
        title: effectiveTitle,
        description: description.trim(),
        priority: severityToPriority(severity),
        status: 'new',
      }, user?.id);

      setSubmitStatus('success');
      setSubmitMessage('Thank you for your feedback! We\'ll review it shortly.');
      setTitle('');
      setDescription('');
      setSeverity(3);
      
      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false);
        setSubmitStatus('idle');
        setSubmitMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setSubmitStatus('error');
      setSubmitMessage('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCategory('general');
    setTitle('');
    setDescription('');
    setSeverity(3);
    setSubmitStatus('idle');
    setSubmitMessage('');
  };

  return (
    <>
      {/* Floating Feedback Button */}
      <button
        onClick={() => { setIsOpen(true); resetForm(); }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-full shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-700 transition-all hover:scale-105 group"
        title="Send Beta Feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-medium">Beta Feedback</span>
      </button>

      {/* Feedback Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-slate-800 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <MessageSquarePlus className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Beta Feedback</h3>
                  <p className="text-xs text-slate-400">Help us improve the app</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success/Error State */}
            {submitStatus === 'success' ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Feedback Submitted!</h4>
                <p className="text-slate-400 text-sm">{submitMessage}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(categoryConfig) as FeedbackCategory[]).map(cat => {
                      const config = categoryConfig[cat];
                      const Icon = config.icon;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                            category === cat
                              ? `${config.bg} border-current ${config.color}`
                              : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{categoryConfig[category].description}</p>
                </div>

                {/* Title (maps to DB `title` column — was previously missing) */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Title <span className="text-slate-500 font-normal">(optional — auto-generated if blank)</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      category === 'bug'
                        ? 'e.g. Parts inventory won\'t save'
                        : category === 'feature'
                        ? 'e.g. Add dark mode toggle'
                        : 'Brief summary of your feedback'
                    }
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  />
                </div>

                {/* Priority Rating (maps to DB `priority` column — was incorrectly sent as "severity") */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {category === 'bug' ? 'Severity' : category === 'feature' ? 'Priority' : 'Importance'}
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSeverity(level)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            level <= severity
                              ? 'text-orange-400 fill-orange-400'
                              : 'text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-slate-400">
                      {severityToPriority(severity)}
                    </span>
                  </div>
                </div>

                {/* Description (maps to DB `description` column — was already correct) */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {category === 'bug' ? 'Describe the bug' : category === 'feature' ? 'Describe your idea' : 'Your feedback'}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder={
                      category === 'bug'
                        ? 'What happened? What did you expect to happen? Steps to reproduce...'
                        : category === 'feature'
                        ? 'Describe the feature you\'d like to see and how it would help...'
                        : 'Share your thoughts, suggestions, or general experience...'
                    }
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors resize-none"
                    required
                  />
                </div>

                {/* Page Context Info (display-only — NOT sent to DB) */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Current page: {currentPage || 'Dashboard'}</span>
                </div>

                {/* Error Message */}
                {submitStatus === 'error' && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-300">{submitMessage}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default BetaFeedback;
