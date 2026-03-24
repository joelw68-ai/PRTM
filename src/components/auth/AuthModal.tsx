import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  Flag,
  ArrowLeft,
  Eye,
  EyeOff,
  ShieldCheck,
  Play,
  KeyRound,
  Send,
  Info
} from 'lucide-react';


interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset' | 'confirmation-sent' | 'auto-confirmed';

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { 
    signIn, signUp, resetPassword, updatePassword, resendConfirmation,
    enableDemoMode, showPasswordReset, setShowPasswordReset, 
    emailConfirmed, clearEmailConfirmed
  } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [lastSignupEmail, setLastSignupEmail] = useState('');
  const [showEmailTroubleshoot, setShowEmailTroubleshoot] = useState(false);

  // Handle password recovery redirect
  useEffect(() => {
    if (showPasswordReset) {
      setMode('reset');
    }
  }, [showPasswordReset]);

  // Handle email confirmation
  useEffect(() => {
    if (emailConfirmed) {
      setSuccess('Your email has been confirmed! You are now signed in.');
      setMode('login');
      clearEmailConfirmed();
    }
  }, [emailConfirmed, clearEmailConfirmed]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Reset mode when modal opens
  useEffect(() => {
    if (isOpen && !showPasswordReset) {
      setMode(initialMode);
      setError(null);
      setSuccess(null);
      setShowEmailTroubleshoot(false);
    }
  }, [isOpen, initialMode, showPasswordReset]);

  if (!isOpen && !showPasswordReset) return null;

  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    
    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-orange-500' };
    if (score <= 3) return { score: 3, label: 'Good', color: 'bg-yellow-500' };
    if (score <= 4) return { score: 4, label: 'Strong', color: 'bg-green-500' };
    return { score: 5, label: 'Very Strong', color: 'bg-emerald-500' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }

        const result = await signUp(email, password, teamName || 'My Race Team');
        
        if (result.error) {
          if (result.error.message.includes('already registered')) {
            setError('This email is already registered. Try signing in instead.');
          } else if (result.error.message.includes('rate limit') || result.error.message.includes('too many')) {
            setError('Too many signup attempts. Please wait a few minutes and try again.');
          } else if (result.error.message.includes('not authorized') || result.error.message.includes('signup is disabled')) {
            setError('Signups are currently disabled. Please contact the team administrator.');
          } else {
            setError(result.error.message);
          }
        } else if (result.autoConfirmed) {
          // User was auto-confirmed (email confirmation disabled in Supabase)
          // They're now logged in automatically
          setSuccess('Account created successfully! You are now signed in.');
          setMode('auto-confirmed');
          setTimeout(() => {
            onClose();
          }, 2000);
        } else if (result.needsConfirmation) {
          // Confirmation email was sent
          setLastSignupEmail(email);
          setMode('confirmation-sent');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setTeamName('');
        }
      } else if (mode === 'login') {
        const { error } = await signIn(email, password);
        
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please check your credentials and try again.');
          } else if (error.message.includes('Email not confirmed')) {
            setError('Please confirm your email address first. Check your inbox for a confirmation link.');
            setLastSignupEmail(email);
          } else {
            setError(error.message);
          }
        } else {
          onClose();
        }
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        
        if (error) {
          if (error.message.includes('rate limit')) {
            setError('Too many reset attempts. Please wait a few minutes and try again.');
          } else {
            setError(error.message);
          }
        } else {
          setSuccess('Password reset email sent! Check your inbox for a link to reset your password.');
        }
      } else if (mode === 'reset') {
        if (newPassword !== confirmNewPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        if (newPassword.length < 6) {
          setError('Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }

        const { error } = await updatePassword(newPassword);
        
        if (error) {
          setError(error.message);
        } else {
          setSuccess('Password updated successfully! You are now signed in.');
          setShowPasswordReset(false);
          setTimeout(() => onClose(), 2000);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('[AuthModal] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0 || !lastSignupEmail) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await resendConfirmation(lastSignupEmail);
      if (error) {
        if (error.message.includes('rate limit')) {
          setError('Email rate limit reached. Supabase free tier allows ~3 emails per hour. Please wait and try again.');
        } else {
          setError(error.message);
        }
      } else {
        setSuccess('Confirmation email resent! Check your inbox (and spam folder).');
        setResendCooldown(60);
      }
    } catch {
      setError('Failed to resend confirmation email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoMode = () => {
    enableDemoMode();
    onClose();
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setShowEmailTroubleshoot(false);
  };

  const handleClose = () => {
    if (showPasswordReset) {
      setShowPasswordReset(false);
    }
    onClose();
  };

  const passwordStrength = mode === 'signup' ? getPasswordStrength(password) : 
                            mode === 'reset' ? getPasswordStrength(newPassword) : null;

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome Back';
      case 'signup': return 'Create Account';
      case 'forgot': return 'Reset Password';
      case 'reset': return 'Set New Password';
      case 'confirmation-sent': return 'Check Your Email';
      case 'auto-confirmed': return 'Account Created';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return 'Sign in to your team logbook';
      case 'signup': return 'Start tracking your race data';
      case 'forgot': return 'We\'ll send you a reset link';
      case 'reset': return 'Enter your new password below';
      case 'confirmation-sent': return 'We sent a confirmation link';
      case 'auto-confirmed': return 'You\'re all set!';
    }
  };

  const getIcon = () => {
    switch (mode) {
      case 'forgot': return <KeyRound className="w-5 h-5 text-white" />;
      case 'reset': return <ShieldCheck className="w-5 h-5 text-white" />;
      case 'confirmation-sent': return <Send className="w-5 h-5 text-white" />;
      case 'auto-confirmed': return <CheckCircle className="w-5 h-5 text-white" />;
      default: return <Flag className="w-5 h-5 text-white" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {(mode === 'forgot' || mode === 'confirmation-sent') && (
              <button
                onClick={() => switchMode('login')}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              mode === 'auto-confirmed' 
                ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                : 'bg-gradient-to-br from-orange-500 to-red-600'
            }`}>
              {getIcon()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {getTitle()}
              </h2>
              <p className="text-sm text-slate-400">
                {getSubtitle()}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-Confirmed View (email confirmation was disabled) */}
        {mode === 'auto-confirmed' ? (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-white font-semibold text-lg mb-2">
                Welcome to Professional Racing Management!
              </p>
              <p className="text-slate-400 text-sm">
                Your account has been created and you're now signed in. Redirecting to your dashboard...
              </p>
            </div>
            
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}
          </div>
        ) : mode === 'confirmation-sent' ? (
          /* Email Confirmation Sent View */
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full flex items-center justify-center border border-blue-500/30 animate-pulse">
                <Mail className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-slate-300 mb-2">
                We sent a confirmation link to:
              </p>
              <p className="text-white font-semibold text-lg mb-4">
                {lastSignupEmail}
              </p>
              <p className="text-slate-400 text-sm mb-2">
                Click the link in the email to verify your account and start using Professional Racing Management.
              </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            {/* Resend Button */}
            <button
              onClick={handleResendConfirmation}
              disabled={isLoading || resendCooldown > 0}
              className="w-full py-3 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {resendCooldown > 0 
                ? `Resend in ${resendCooldown}s` 
                : 'Resend Confirmation Email'}
            </button>

            {/* Troubleshooting Section */}
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/50">
              <button
                onClick={() => setShowEmailTroubleshoot(!showEmailTroubleshoot)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-300">Didn't receive the email?</span>
                </div>
                <svg 
                  className={`w-4 h-4 text-slate-400 transition-transform ${showEmailTroubleshoot ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showEmailTroubleshoot && (
                <div className="px-4 pb-4 space-y-3">
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <span>Check your <strong className="text-slate-300">spam/junk folder</strong> — confirmation emails sometimes end up there</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <span>Make sure <strong className="text-slate-300">{lastSignupEmail}</strong> is spelled correctly</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <span>The email comes from <strong className="text-slate-300">noreply@mail.app.supabase.io</strong> — check if it's blocked</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <span>Wait 1-2 minutes — emails can sometimes be delayed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <span>Try the <strong className="text-slate-300">Resend</strong> button above (limit: ~3 per hour on free tier)</span>
                    </li>
                  </ul>
                  
                  {/* Admin note for beta testers */}
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-300/90">
                        <p className="font-semibold mb-1">Beta Tester Note</p>
                        <p className="text-amber-300/70">
                          If emails aren't arriving, the project admin may need to verify that <strong>email confirmations are enabled</strong> in the Supabase Dashboard under Authentication &gt; Settings &gt; Email Auth. The Supabase free tier also limits emails to ~3 per hour.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Try signing in anyway (in case they confirmed already) */}
            <div className="text-center space-y-2">
              <p className="text-xs text-slate-500">Already confirmed your email?</p>
              <button
                onClick={() => {
                  setEmail(lastSignupEmail);
                  switchMode('login');
                }}
                className="text-sm text-orange-400 hover:text-orange-300 font-medium"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        ) : (
          /* Form Views */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span>{error}</span>
                  {error.includes('confirm your email') && lastSignupEmail && (
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resendCooldown > 0}
                      className="block mt-1 text-orange-400 hover:text-orange-300 font-medium underline"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            {/* Password Reset Form */}
            {mode === 'reset' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      className="w-full pl-10 pr-12 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Password Strength */}
                  {passwordStrength && newPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              i <= passwordStrength.score ? passwordStrength.color : 'bg-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ${
                        passwordStrength.score <= 1 ? 'text-red-400' :
                        passwordStrength.score <= 2 ? 'text-orange-400' :
                        passwordStrength.score <= 3 ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {passwordStrength.label}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  {confirmNewPassword && newPassword !== confirmNewPassword && (
                    <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Update Password
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                {/* Team Name (signup only) */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Team Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Enter your team name"
                        className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Password (login & signup only) */}
                {(mode === 'login' || mode === 'signup') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-300">
                        Password
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                        required
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        className="w-full pl-10 pr-12 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Password Strength (signup only) */}
                    {mode === 'signup' && passwordStrength && password && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                i <= passwordStrength.score ? passwordStrength.color : 'bg-slate-600'
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`text-xs ${
                          passwordStrength.score <= 1 ? 'text-red-400' :
                          passwordStrength.score <= 2 ? 'text-orange-400' :
                          passwordStrength.score <= 3 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {passwordStrength.label}
                          {passwordStrength.score < 3 && ' — try adding uppercase, numbers, or symbols'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Confirm Password (signup only) */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        required
                        autoComplete="new-password"
                        className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {mode === 'login' ? 'Signing In...' : 
                       mode === 'signup' ? 'Creating Account...' : 
                       'Sending Reset Link...'}
                    </>
                  ) : (
                    mode === 'login' ? 'Sign In' : 
                    mode === 'signup' ? 'Create Account' : 
                    'Send Reset Link'
                  )}
                </button>

                {/* Divider */}
                {(mode === 'login' || mode === 'signup') && (
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-slate-800 text-slate-500 uppercase tracking-wider">or</span>
                    </div>
                  </div>
                )}

                {/* Demo Mode Button */}
                {(mode === 'login' || mode === 'signup') && (
                  <button
                    type="button"
                    onClick={handleDemoMode}
                    className="w-full py-3 bg-slate-700/50 border border-slate-600 text-slate-300 font-medium rounded-lg hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all flex items-center justify-center gap-2 group"
                  >
                    <Play className="w-4 h-4 text-green-400 group-hover:text-green-300" />
                    Try Demo Mode
                    <span className="text-xs text-slate-500 group-hover:text-slate-400">— No account needed</span>
                  </button>
                )}

                {/* Switch Mode */}
                <div className="text-center text-sm text-slate-400">
                  {mode === 'login' ? (
                    <>
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className="text-orange-400 hover:text-orange-300 font-medium"
                      >
                        Sign up
                      </button>
                    </>
                  ) : mode === 'signup' ? (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="text-orange-400 hover:text-orange-300 font-medium"
                      >
                        Sign in
                      </button>
                    </>
                  ) : mode === 'forgot' ? (
                    <>
                      Remember your password?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="text-orange-400 hover:text-orange-300 font-medium"
                      >
                        Sign in
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            )}
          </form>
        )}

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-center text-slate-500">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
