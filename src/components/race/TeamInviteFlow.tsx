import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  TeamInvite,
  TeamMembership,
  fetchTeamInvites,
  sendTeamInvite,
  revokeTeamInvite,
  fetchTeamMemberships,
  removeMembership,
  updateMembershipRole,
  getInviteByToken,
  acceptInvite,
  fetchMyTeamMemberships
} from '@/lib/teamMembership';
import {
  Mail,
  UserPlus,
  X,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  Link2,
  Shield,
  Eye,
  Edit2,
  Trash2,
  Users,
  Loader2,
  XCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface TeamInviteFlowProps {
  teamName: string;
  invitedByName: string;
}

const TeamInviteFlow: React.FC<TeamInviteFlowProps> = ({ teamName, invitedByName }) => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  // Store the last created invite link for prominent display
  const [lastCreatedLink, setLastCreatedLink] = useState<string | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'Crew' as string,
    permissions: ['view'] as string[]
  });

  const memberRoles = ['Owner', 'Driver', 'Crew Chief', 'Crew', 'Mechanic', 'Tuner', 'Sponsor'];

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [inv, mem] = await Promise.all([
        fetchTeamInvites(user.id),
        fetchTeamMemberships(user.id)
      ]);
      setInvites(inv);
      setMemberships(mem);
    } catch (err: any) {
      console.error('Failed to load invites:', err);
      setError(`Failed to load invites: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteForm.email) {
      setError('Email is required');
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    setLastCreatedLink(null);

    try {
      const result = await sendTeamInvite({
        email: inviteForm.email,
        role: inviteForm.role,
        permissions: inviteForm.permissions,
        teamName,
        invitedByName
      });

      const link = result.inviteLink;
      
      // Auto-copy the invite link to clipboard
      try { await navigator.clipboard.writeText(link); } catch {}

      setLastCreatedLink(link);
      setSuccess(`Invite created for ${inviteForm.email}! Share the link below with your team member.`);
      setCopiedLink(link);

      setInviteForm({ email: '', role: 'Crew', permissions: ['view'] });
      setShowInviteForm(false);
      await loadData();
    } catch (err: any) {
      console.error('sendTeamInvite failed:', err);
      setError(err.message || 'Failed to create invitation');
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!confirm('Revoke this invitation?')) return;
    try {
      await revokeTeamInvite(inviteId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!confirm('Remove this team member? They will lose access to team data.')) return;
    try {
      await removeMembership(membershipId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getInviteLink = (token: string) => {
    return `${window.location.origin}/invite/${token}`;
  };

  const copyInviteLink = async (token: string) => {
    const link = getInviteLink(token);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(token);
      setTimeout(() => setCopiedLink(null), 3000);
    } catch {
      // Fallback: select text in a temporary input
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(token);
      setTimeout(() => setCopiedLink(null), 3000);
    }
  };

  const togglePermission = (perm: string) => {
    setInviteForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs"><Clock className="w-3 h-3" /> Pending</span>;
      case 'accepted':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs"><CheckCircle className="w-3 h-3" /> Accepted</span>;
      case 'expired':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded text-xs"><Clock className="w-3 h-3" /> Expired</span>;
      case 'revoked':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs"><XCircle className="w-3 h-3" /> Revoked</span>;
      default:
        return null;
    }
  };

  const pendingInvites = invites.filter(i => i.status === 'pending');
  const pastInvites = invites.filter(i => i.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            Team Invitations & Access
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Invite crew members by sharing a link. They sign up and are automatically added to your team.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowInviteForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Send Invite
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1 break-words">{error}</div>
          <button onClick={() => setError(null)} className="ml-auto flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}
      
      {/* Success with prominent invite link */}
      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{success}</span>
            <button onClick={() => { setSuccess(null); setLastCreatedLink(null); }} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
          
          {lastCreatedLink && (
            <div className="bg-slate-900/70 rounded-lg p-3 border border-slate-700">
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Share this invite link:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={lastCreatedLink}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-orange-400 text-sm font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(lastCreatedLink).catch(() => {});
                    setCopiedLink(lastCreatedLink);
                    setTimeout(() => setCopiedLink(null), 3000);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    copiedLink === lastCreatedLink
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {copiedLink === lastCreatedLink ? (
                    <><CheckCircle className="w-4 h-4" /> Copied!</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Copy Link</>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Send this link to your team member via text, email, or any messaging app. They'll create an account and be automatically added to your team.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active Members */}
      {memberships.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-green-400" />
            Active Linked Accounts ({memberships.length})
          </h4>
          <div className="space-y-2">
            {memberships.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">User ID: {m.memberUserId.slice(0, 8)}...</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{m.role}</span>
                      {m.permissions.map(p => (
                        <span key={p} className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMember(m.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                  title="Remove member"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-yellow-500/20 p-4">
          <h4 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending Invitations ({pendingInvites.length})
          </h4>
          <div className="space-y-3">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="p-3 bg-slate-900/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <Mail className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{invite.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{invite.role}</span>
                        {getStatusBadge(invite.status)}
                        <span className="text-xs text-slate-500">
                          Expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(invite.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                    title="Revoke invite"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Invite link display */}
                <div className="bg-slate-800/70 rounded-lg p-2 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-xs text-orange-400 font-mono truncate flex-1">
                    {getInviteLink(invite.token)}
                  </span>
                  <button
                    onClick={() => copyInviteLink(invite.token)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                      copiedLink === invite.token 
                        ? 'text-green-400 bg-green-500/20' 
                        : 'text-blue-400 bg-blue-500/20 hover:bg-blue-500/30'
                    }`}
                  >
                    {copiedLink === invite.token ? (
                      <><CheckCircle className="w-3 h-3" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Copy</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Invites (collapsed) */}
      {pastInvites.length > 0 && (
        <details className="bg-slate-800/30 rounded-xl border border-slate-700/30">
          <summary className="p-4 cursor-pointer text-sm text-slate-400 hover:text-white">
            Past Invitations ({pastInvites.length})
          </summary>
          <div className="px-4 pb-4 space-y-2">
            {pastInvites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between p-2 bg-slate-900/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">{invite.email}</span>
                  {getStatusBadge(invite.status)}
                </div>
                <span className="text-xs text-slate-500">{new Date(invite.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Empty State */}
      {invites.length === 0 && memberships.length === 0 && !loading && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-8 text-center">
          <Mail className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No invitations sent yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Send an invite to generate a shareable link for your crew members
          </p>
        </div>
      )}

      {/* Send Invite Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-400" />
                  Send Team Invite
                </h3>
                <button onClick={() => setShowInviteForm(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="crewmember@email.com"
                />
                <p className="text-xs text-slate-500 mt-1">
                  This email is recorded for tracking. You'll share the invite link manually.
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  {memberRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Permissions</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => togglePermission('view')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded border ${
                      inviteForm.permissions.includes('view')
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}
                  >
                    <Eye className="w-4 h-4" /> View
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePermission('edit')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded border ${
                      inviteForm.permissions.includes('edit')
                        ? 'bg-green-500/20 text-green-400 border-green-500/50'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePermission('admin')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded border ${
                      inviteForm.permissions.includes('admin')
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}
                  >
                    <Shield className="w-4 h-4" /> Admin
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">How it works:</strong> After clicking "Create Invite", you'll get a shareable link. Send this link to your crew member via text, email, or any messaging app. When they click the link, they'll create an account and be automatically added to your team as <strong className="text-orange-400">{inviteForm.role}</strong>. The link expires in 7 days.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowInviteForm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                disabled={sending || !inviteForm.email}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Create Invite Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamInviteFlow;

// ============ INVITE ACCEPT BANNER ============
// This banner handles the LEGACY ?invite=TOKEN query param format.
// The new /invite/TOKEN path format is handled by InviteAcceptPage.
export const InviteAcceptBanner: React.FC = () => {
  const { user } = useAuth();
  const [invite, setInvite] = useState<TeamInvite | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (token) {
      // Redirect to the new /invite/TOKEN page instead of handling inline
      window.location.href = `${window.location.origin}/invite/${token}`;
    }
  }, []);

  const handleAccept = async () => {
    if (!invite || !user?.id) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptInvite(invite.token, user.id);
      setAccepted(true);
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      window.history.replaceState({}, '', url.pathname);
      // Reload to pick up new team data
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (!invite || dismissed) return null;

  if (accepted) {
    return (
      <div className="fixed top-16 left-0 right-0 z-40 bg-green-500/20 border-b border-green-500/30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-green-400 text-sm font-medium">
            You've joined {invite.teamName}! Reloading to show team data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-blue-500/20 border-b border-blue-500/30 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">
              You've been invited to join <strong>{invite.teamName}</strong> as <strong>{invite.role}</strong>
            </p>
            {invite.invitedByName && (
              <p className="text-blue-300 text-xs">Invited by {invite.invitedByName}</p>
            )}
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {accepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Accept Invite
            </button>
          ) : (
            <p className="text-blue-300 text-xs">Sign in or create an account to accept this invite</p>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
