import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  User, Mail, Lock, Save, Loader2, CheckCircle, AlertCircle,
  Eye, EyeOff, Shield, KeyRound, AtSign, UserCircle, Info,
  ChevronRight, X, AlertTriangle
} from 'lucide-react';

interface ProfileSettingsProps {
  onNavigate?: (section: string) => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onNavigate }) => {
  const { user, profile, updateProfile, refreshProfile, isDemoMode } = useAuth();

  // ── Display Name / Profile Info ──
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // ── Change Email ──
  const [newEmail, setNewEmail] = useState('');
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  // ── Change Password ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Load profile data
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.driverName || '');
      setContactEmail(profile.contactEmail || user?.email || '');
      setContactPhone(profile.contactPhone || '');
    }
  }, [profile, user]);

  // Auto-clear success messages
  useEffect(() => {
    if (profileSuccess) {
      const t = setTimeout(() => setProfileSuccess(''), 5000);
      return () => clearTimeout(t);
    }
  }, [profileSuccess]);
  useEffect(() => {
    if (emailSuccess) {
      const t = setTimeout(() => setEmailSuccess(''), 8000);
      return () => clearTimeout(t);
    }
  }, [emailSuccess]);
  useEffect(() => {
    if (passwordSuccess) {
      const t = setTimeout(() => setPasswordSuccess(''), 5000);
      return () => clearTimeout(t);
    }
  }, [passwordSuccess]);

  // ── Handle Profile Save ──
  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const { error } = await updateProfile({
        driverName: displayName,
        contactEmail,
        contactPhone,
      });
      if (error) {
        setProfileError(error.message);
      } else {
        setProfileSuccess('Profile information updated successfully.');
        await refreshProfile();
      }
    } catch (err: any) {
      setProfileError(err?.message || 'An unexpected error occurred.');
    }
    setProfileSaving(false);
  };

  // ── Handle Email Change ──
  const handleEmailChangeRequest = () => {
    if (!newEmail.trim()) {
      setEmailError('Please enter a new email address.');
      return;
    }
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setEmailError('The new email is the same as your current email.');
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    setEmailConfirmOpen(true);
  };

  const handleEmailChangeConfirm = async () => {
    setEmailSaving(true);
    setEmailError('');
    setEmailSuccess('');
    setEmailConfirmOpen(false);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      if (error) {
        setEmailError(error.message);
      } else {
        setEmailSuccess(
          'A confirmation email has been sent to both your current and new email addresses. Please check your inbox and confirm the change.'
        );
        setNewEmail('');
      }
    } catch (err: any) {
      setEmailError(err?.message || 'An unexpected error occurred.');
    }
    setEmailSaving(false);
  };

  // ── Handle Password Change ──
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setPasswordSaving(true);

    try {
      // Step 1: Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Current password is incorrect. Please try again.');
        setPasswordSaving(false);
        return;
      }

      // Step 2: Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message);
      } else {
        setPasswordSuccess('Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'An unexpected error occurred.');
    }
    setPasswordSaving(false);
  };

  // Password strength indicator
  const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (!pw) return { label: '', color: '', width: '0%' };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '20%' };
    if (score === 2) return { label: 'Fair', color: 'bg-orange-500', width: '40%' };
    if (score === 3) return { label: 'Good', color: 'bg-yellow-500', width: '60%' };
    if (score === 4) return { label: 'Strong', color: 'bg-green-500', width: '80%' };
    return { label: 'Very Strong', color: 'bg-emerald-400', width: '100%' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  if (isDemoMode) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center">
          <Shield className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Account Settings</h3>
          <p className="text-slate-400">
            Account settings are not available in demo mode. Please sign up or sign in to manage your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <UserCircle className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Account Settings</h2>
          <p className="text-slate-400 text-sm">Manage your login credentials and personal information</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: Display Name & Profile Information
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Profile Information</h3>
            <p className="text-xs text-slate-500">Update your display name and contact details</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name (shown across the app)"
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="team@example.com"
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <p className="text-[11px] text-slate-600 mt-1">This is your team contact email, not your login email.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Success / Error */}
          {profileSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-emerald-300">{profileSuccess}</span>
            </div>
          )}
          {profileError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">{profileError}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: Change Email Address
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <AtSign className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Change Email Address</h3>
            <p className="text-xs text-slate-500">Update the email you use to sign in</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Current email display */}
          <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
            <Mail className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 font-medium">Current Login Email</p>
              <p className="text-white text-sm font-mono">{user?.email || 'Not available'}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">New Email Address</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setEmailError(''); }}
              placeholder="Enter your new email address"
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-300/80">
              Supabase will send a confirmation link to both your current and new email addresses. 
              You must confirm from both to complete the change.
            </p>
          </div>

          {/* Success / Error */}
          {emailSuccess && (
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-emerald-300">{emailSuccess}</span>
            </div>
          )}
          {emailError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">{emailError}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleEmailChangeRequest}
              disabled={emailSaving || !newEmail.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Update Email
            </button>
          </div>
        </div>
      </div>

      {/* Email Confirmation Modal */}
      {emailConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Confirm Email Change</h3>
              </div>
              <button
                onClick={() => setEmailConfirmOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-300 text-sm">
                You are about to change your login email from:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 bg-slate-900/50 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-500 w-14">Current:</span>
                  <span className="text-white text-sm font-mono">{user?.email}</span>
                </div>
                <div className="flex items-center justify-center">
                  <ChevronRight className="w-4 h-4 text-slate-600 rotate-90" />
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-blue-500/5 rounded-lg border border-blue-500/30">
                  <span className="text-xs text-slate-500 w-14">New:</span>
                  <span className="text-blue-300 text-sm font-mono">{newEmail}</span>
                </div>
              </div>
              <p className="text-slate-400 text-xs">
                Confirmation emails will be sent to both addresses. This action cannot be undone without repeating the process.
              </p>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setEmailConfirmOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleEmailChangeConfirm}
                disabled={emailSaving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {emailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: Change Password
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Change Password</h3>
            <p className="text-xs text-slate-500">Update your account password</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); }}
                placeholder="Enter your current password"
                className="w-full px-4 py-2.5 pr-12 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                placeholder="Enter your new password"
                className="w-full px-4 py-2.5 pr-12 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Password strength meter */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: passwordStrength.width }}
                  />
                </div>
                <p className={`text-xs ${
                  passwordStrength.label === 'Weak' ? 'text-red-400' :
                  passwordStrength.label === 'Fair' ? 'text-orange-400' :
                  passwordStrength.label === 'Good' ? 'text-yellow-400' :
                  'text-emerald-400'
                }`}>
                  Strength: {passwordStrength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                placeholder="Re-enter your new password"
                className={`w-full px-4 py-2.5 pr-12 bg-slate-900/50 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-red-500/50'
                    : confirmPassword && confirmPassword === newPassword
                    ? 'border-emerald-500/50'
                    : 'border-slate-600'
                }`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
            )}
            {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Passwords match
              </p>
            )}
          </div>

          {/* Success / Error */}
          {passwordSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-emerald-300">{passwordSuccess}</span>
            </div>
          )}
          {passwordError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-300">{passwordError}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          Account Info Footer
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-5">
        <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Account Information
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Account ID</p>
            <p className="text-slate-300 font-mono text-xs truncate">{user?.id || 'N/A'}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Created</p>
            <p className="text-slate-300 text-xs">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5">Last Sign In</p>
            <p className="text-slate-300 text-xs">
              {user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
