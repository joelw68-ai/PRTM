import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getInviteByToken, acceptInvite, TeamInvite } from '@/lib/teamMembership';
import {
  Mail,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield,
  Clock,
  XCircle,
  LogIn,
  UserPlus,
  ArrowRight,
  Eye,
  Edit2
} from 'lucide-react';

const InviteAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();

  const [invite, setInvite] = useState<TeamInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Load invite details
  useEffect(() => {
    const loadInvite = async () => {
      if (!token) {
        setInviteError('No invite token provided');
        setLoading(false);
        return;
      }

      try {
        const inv = await getInviteByToken(token);
        if (!inv) {
          setInviteError('This invitation was not found. It may have been revoked or the link is incorrect.');
        } else if (inv.status === 'expired') {
          setInviteError('This invitation has expired. Please ask the team owner to send a new one.');
          setInvite(inv);
        } else if (inv.status === 'revoked') {
          setInviteError('This invitation has been revoked.');
          setInvite(inv);
        } else if (inv.status === 'accepted') {
          setInviteError('This invitation has already been accepted.');
          setInvite(inv);
        } else {
          setInvite(inv);
          // Pre-fill email if available
          if (inv.email) setEmail(inv.email);
        }
      } catch (err: any) {
        console.error('Failed to load invite:', err);
        setInviteError(err.message || 'Failed to load invitation details');
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [token]);

  // Auto-accept when user is logged in and invite is valid
  useEffect(() => {
    if (user && invite && invite.status === 'pending' && !accepted && !accepting) {
      handleAcceptInvite();
    }
  }, [user, invite]);

  const handleAcceptInvite = async () => {
    if (!invite || !user || !token) return;
    
    setAccepting(true);
    setError(null);

    try {
      await acceptInvite(token, user.id);
      setAccepted(true);
      // Redirect to main app after 3 seconds
      setTimeout(() => {
        navigate('/');
        window.location.reload();
      }, 3000);
    } catch (err: any) {
      console.error('Failed to accept invite:', err);
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          setAuthError(error.message);
        }
        // If successful, the useEffect above will auto-accept
      } else {
        const result = await signUp(email, password, teamName || undefined);
        if (result.error) {
          setAuthError(result.error.message);
        } else if (result.needsConfirmation) {
          setSignupSuccess(true);
        }
        // If auto-confirmed, the useEffect above will auto-accept
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const getPermissionLabel = (perm: string) => {
    switch (perm) {
      case 'view': return { icon: Eye, label: 'View Data', color: 'text-blue-400' };
      case 'edit': return { icon: Edit2, label: 'Edit Data', color: 'text-green-400' };
      case 'admin': return { icon: Shield, label: 'Admin Access', color: 'text-purple-400' };
      default: return { icon: Eye, label: perm, color: 'text-slate-400' };
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Invite error state
  if (inviteError && !invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl border border-slate-700 p-8 text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Invitation Not Found</h1>
          <p className="text-slate-400 mb-6">{inviteError}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Accepted state
  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl border border-green-500/30 p-8 text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to the Team!</h1>
          <p className="text-slate-400 mb-2">
            You've successfully joined <strong className="text-white">{invite?.teamName}</strong> as <strong className="text-orange-400">{invite?.role}</strong>.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Redirecting to the app in a few seconds...
          </p>
          <button
            onClick={() => { navigate('/'); window.location.reload(); }}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-2 mx-auto"
          >
            Go to App Now
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Signup success (needs email confirmation)
  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl border border-blue-500/30 p-8 text-center">
          <Mail className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
          <p className="text-slate-400 mb-4">
            We've sent a confirmation email to <strong className="text-white">{email}</strong>.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            After confirming your email, come back to this invite link to join <strong className="text-white">{invite?.teamName}</strong>.
          </p>
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-400">
              <strong className="text-slate-300">Invite Link:</strong>
              <br />
              <span className="text-orange-400 break-all">{window.location.href}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Invite Card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border-b border-slate-700 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-orange-500/20 rounded-full flex items-center justify-center">
                <Users className="w-7 h-7 text-orange-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Team Invitation</h1>
                <p className="text-slate-400 text-sm">You've been invited to join a racing team</p>
              </div>
            </div>
          </div>

          {/* Invite Details */}
          <div className="p-6 border-b border-slate-700">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Team</span>
                <span className="text-white font-semibold text-lg">{invite?.teamName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Your Role</span>
                <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-lg font-medium">
                  {invite?.role}
                </span>
              </div>
              {invite?.invitedByName && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Invited By</span>
                  <span className="text-white">{invite.invitedByName}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Expires</span>
                <span className="text-slate-300 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-slate-500" />
                  {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>

              {/* Permissions */}
              {invite?.permissions && invite.permissions.length > 0 && (
                <div>
                  <span className="text-slate-400 text-sm block mb-2">Permissions</span>
                  <div className="flex gap-2 flex-wrap">
                    {invite.permissions.map(perm => {
                      const { icon: Icon, label, color } = getPermissionLabel(perm);
                      return (
                        <span key={perm} className={`flex items-center gap-1 px-2 py-1 bg-slate-700/50 rounded text-sm ${color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Status warnings */}
            {inviteError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {inviteError}
              </div>
            )}
          </div>

          {/* Action Area */}
          <div className="p-6">
            {/* Error display */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {user ? (
              // User is logged in — show accept button
              <div className="text-center">
                <p className="text-slate-400 mb-4">
                  Signed in as <strong className="text-white">{user.email}</strong>
                </p>
                {accepting ? (
                  <div className="flex items-center justify-center gap-2 text-orange-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Joining team...</span>
                  </div>
                ) : invite?.status === 'pending' ? (
                  <button
                    onClick={handleAcceptInvite}
                    className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Accept Invitation & Join Team
                  </button>
                ) : null}
              </div>
            ) : (
              // User is NOT logged in — show auth form
              <div>
                <p className="text-slate-400 text-sm text-center mb-4">
                  Sign in or create an account to accept this invitation
                </p>

                {/* Auth mode toggle */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                      authMode === 'signup'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <UserPlus className="w-4 h-4 inline mr-1" />
                    Sign Up
                  </button>
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError(null); }}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                      authMode === 'login'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <LogIn className="w-4 h-4 inline mr-1" />
                    Sign In
                  </button>
                </div>

                {authError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500"
                      placeholder={authMode === 'signup' ? 'Create a password (6+ chars)' : 'Enter your password'}
                    />
                  </div>

                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Your Team Name (optional)</label>
                      <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500"
                        placeholder="My Racing Team"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading || !email || !password}
                    className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {authLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : authMode === 'signup' ? (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Create Account & Join Team
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        Sign In & Join Team
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Back to home link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Go to home page
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteAcceptPage;
