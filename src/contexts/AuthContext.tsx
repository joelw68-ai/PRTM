import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { parseRows } from '@/lib/validatedQuery';
import { TeamMembershipRowSchema } from '@/lib/validators';

export interface DriverLicense {
  id: string;
  sanctioningBody: 'NHRA' | 'IHRA';
  licenseClass: string;
  licenseNumber: string;
  expirationDate: string;
  isPrimary: boolean;
}

export interface UserProfile {
  id: string;
  teamName: string;
  driverName?: string;
  driverLicenseNumber?: string;
  driverLicenseClass?: string;
  driverLicenseExpiration?: string;
  driverLicenses?: DriverLicense[];
  carName?: string;
  carNumber?: string;
  carClass: string;
  carMake?: string;
  carModel?: string;
  carYear?: number;
  carWeight?: number;
  engineType: string;
  fuelType: string;
  homeTrack?: string;
  teamLogoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}



export interface SignUpResult {
  error: AuthError | null;
  needsConfirmation: boolean;
  autoConfirmed: boolean;
}

// Team membership info for crew members
export interface ActiveTeamMembership {
  membershipId: string;
  teamOwnerId: string;
  teamOwnerName: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  showPasswordReset: boolean;
  emailConfirmed: boolean;
  // Team membership
  activeTeamMembership: ActiveTeamMembership | null;
  isTeamMember: boolean;
  effectiveUserId: string | undefined;
  // Data fetch signal - increments when auth confirms a session (SIGNED_IN or session restore)
  dataFetchSignal: number;
  signUp: (email: string, password: string, teamName?: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  resendConfirmation: (email: string) => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
  setShowPasswordReset: (show: boolean) => void;
  clearEmailConfirmed: () => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Convert database row to UserProfile

const toUserProfile = (row: any): UserProfile => ({
  id: row.id,
  teamName: row.team_name || 'My Race Team',
  driverName: row.driver_name,
  driverLicenseNumber: row.driver_license_number,
  driverLicenseClass: row.driver_license_class,
  driverLicenseExpiration: row.driver_license_expiration || undefined,
  driverLicenses: Array.isArray(row.driver_licenses) ? row.driver_licenses : [],
  carName: row.car_name,
  carNumber: row.car_number,
  carClass: row.car_class || 'Pro Mod',
  carMake: row.car_make,
  carModel: row.car_model,
  carYear: row.car_year,
  carWeight: row.car_weight,
  engineType: row.engine_type || 'Supercharged Hemi',
  fuelType: row.fuel_type || 'Methanol',
  homeTrack: row.home_track,
  teamLogoUrl: row.team_logo_url,
  contactEmail: row.contact_email,
  contactPhone: row.contact_phone,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});



// Demo mode profile
const DEMO_PROFILE: UserProfile = {
  id: 'demo-user',
  teamName: 'Demo Racing Team',
  driverName: 'Demo Driver',
  driverLicenseNumber: 'DEMO-001',
  driverLicenseClass: 'NHRA Pro Mod',
  driverLicenses: [
    {
      id: 'demo-lic-1',
      sanctioningBody: 'NHRA',
      licenseClass: 'NHRA Pro Mod',
      licenseNumber: 'NHRA-2026-001',
      expirationDate: '2026-12-31',
      isPrimary: true,
    },
    {
      id: 'demo-lic-2',
      sanctioningBody: 'IHRA',
      licenseClass: 'IHRA Pro Mod',
      licenseNumber: 'IHRA-2026-042',
      expirationDate: '2026-06-15',
      isPrimary: false,
    },
  ],
  carName: 'Demo Machine',
  carNumber: '00',
  carClass: 'Pro Mod',
  carMake: 'Chevrolet',
  carModel: 'Camaro',
  carYear: 2025,
  carWeight: 2650,
  engineType: 'Supercharged Hemi',
  fuelType: 'Methanol',
  homeTrack: 'Demo Dragway',
  contactEmail: 'demo@promodlogbook.com',
  notes: 'This is a demo account with sample data. Sign up to save your own data!',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};


const DEMO_MODE_KEY = 'promod_demo_mode';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(() => {
    try {
      return localStorage.getItem(DEMO_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [activeTeamMembership, setActiveTeamMembership] = useState<ActiveTeamMembership | null>(null);
  // dataFetchSignal: incremented every time a session is confirmed (SIGNED_IN, INITIAL_SESSION, session restore)
  // AppContext watches this to trigger a full data fetch from ALL tables
  const [dataFetchSignal, setDataFetchSignal] = useState(0);
  const mountedRef = useRef(true);
  const initRef = useRef(false);
  // Track whether we've already fired a signal for the current session to avoid duplicates
  const lastSignalSessionIdRef = useRef<string | null>(null);

  // Derived values
  const isTeamMember = !!activeTeamMembership;
  // When user is a team member, use the team owner's ID for data fetching
  const effectiveUserId = activeTeamMembership ? activeTeamMembership.teamOwnerId : user?.id;

  // Helper: fire the data fetch signal (deduplicated per session)
  const fireDataFetchSignal = useCallback((sessionId: string, source: string) => {
    if (lastSignalSessionIdRef.current === sessionId) {
      console.log(`[Auth] Skipping duplicate data fetch signal from ${source} (session already signaled)`);
      return;
    }
    lastSignalSessionIdRef.current = sessionId;
    console.log(`[Auth] Firing data fetch signal from ${source}`);
    setDataFetchSignal(prev => prev + 1);
  }, []);

  // Fetch user profile from database

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      // Try user_id first (migration-created rows)
      const { data: data1, error: err1 } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (data1) return toUserProfile(data1);
      
      // Fallback: try id column (trigger-created rows where id = auth user UUID)
      const { data: data2, error: err2 } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (data2) return toUserProfile(data2);
      
      if (err1) console.warn('[Auth] fetchProfile user_id query error:', err1.message);
      if (err2) console.warn('[Auth] fetchProfile id query error:', err2.message);
      
      return null;
    } catch (err) {
      console.error('[Auth] fetchProfile exception:', err);
      return null;
    }
  };

  // Check if user is a team member (not owner) and load membership
  // CRITICAL: The owner of a team must NEVER be treated as a crew member.
  // We enforce this with multiple layers of protection:
  //   1. Database query excludes rows where team_owner_id = userId
  //   2. JavaScript guard rejects any membership where teamOwnerId matches userId
  //   3. Ownership verification via user_profiles table
  const checkTeamMembership = async (userId: string): Promise<ActiveTeamMembership | null> => {
    try {
      // ── Layer 1: Query-level exclusion ──
      // Only fetch memberships where this user is a MEMBER of SOMEONE ELSE's team.
      // The .neq('team_owner_id', userId) filter ensures the owner's own team
      // is never returned, even if a stale self-referencing row exists from invite testing.
      const { data, error } = await supabase
        .from('team_memberships')
        .select('*')
        .eq('member_user_id', userId)
        .neq('team_owner_id', userId)   // ← Owner can never be a member of their own team
        .eq('status', 'active')
        .order('joined_at', { ascending: false })
        .limit(1);
      
      if (error || !data || data.length === 0) return null;
      
      const validatedRows = parseRows(data, TeamMembershipRowSchema, 'team_memberships');
      if (validatedRows.length === 0) return null;
      const membership = validatedRows[0];


      // ── Layer 2: JavaScript-level guard ──
      // Double-check in case the .neq filter was somehow bypassed or the data is stale.
      if (membership.team_owner_id === userId) {
        console.log('[Auth] Skipping self-referencing team membership — user is the team owner, not a crew member.');
        return null;
      }

      // ── Layer 3: Ownership verification via user_profiles ──
      // If this user has their own user_profiles row, they are a team owner.
      // Check if the membership's team_owner_id matches their own profile,
      // which would mean they somehow got a membership on their own team.
      try {
        const { data: ownProfile } = await supabase
          .from('user_profiles')
          .select('id, user_id')
          .or(`user_id.eq.${userId},id.eq.${userId}`)
          .maybeSingle();
        
        if (ownProfile) {
          // The user has their own profile (they are a team owner).
          // If the membership points back to their own profile, reject it.
          const ownProfileId = ownProfile.user_id || ownProfile.id;
          if (membership.team_owner_id === ownProfileId) {
            console.log('[Auth] Ownership verification: user owns the team referenced in membership — ignoring crew role.');
            return null;
          }
        }
      } catch (profileCheckErr) {
        console.warn('[Auth] Ownership verification query failed (non-fatal):', profileCheckErr);
        // Non-fatal — continue with the membership if the profile check fails
      }

      // ── Membership is valid: user is a crew member on someone else's team ──
      // Fetch the team owner's profile to get team name
      let teamOwnerName = 'Team';
      try {
        const { data: ownerProfile } = await supabase
          .from('user_profiles')
          .select('team_name')
          .eq('user_id', membership.team_owner_id)
          .maybeSingle();
        if (ownerProfile) {
          teamOwnerName = ownerProfile.team_name || 'Team';
        } else {
          // Fallback: try by id column
          const { data: ownerProfile2 } = await supabase
            .from('user_profiles')
            .select('team_name')
            .eq('id', membership.team_owner_id)
            .maybeSingle();
          if (ownerProfile2) {
            teamOwnerName = ownerProfile2.team_name || 'Team';
          }
        }
      } catch {}
      
      console.log('[Auth] Valid team membership found — user is a crew member on team:', teamOwnerName);
      return {
        membershipId: membership.id,
        teamOwnerId: membership.team_owner_id,
        teamOwnerName,
        role: membership.role || 'Crew',
        permissions: membership.permissions || ['view']
      };
    } catch (err) {
      console.warn('[Auth] Team membership check failed:', err);
      return null;
    }
  };


  // Ensure a profile row exists for this user (create if missing)
  const ensureProfile = async (userId: string, teamName?: string): Promise<UserProfile | null> => {
    try {
      let profile = await fetchProfile(userId);
      if (!profile) {
        console.log('[Auth] No profile found, creating one for user:', userId);
        const { error } = await supabase.from('user_profiles').insert({
          id: userId,
          user_id: userId,
          team_name: teamName || 'My Race Team',
        });
        if (error) {
          console.error('[Auth] Profile insert error:', error.message, error.details, error.hint);
          // If insert fails due to conflict, try to fetch again
          profile = await fetchProfile(userId);
        } else {
          console.log('[Auth] Profile created successfully');
          profile = await fetchProfile(userId);
        }
      }
      return profile;
    } catch (err) {
      console.error('[Auth] ensureProfile exception:', err);
      return null;
    }
  };



  // Set demo mode profile on init if demo mode is active
  useEffect(() => {
    if (isDemoMode && !user) {
      setProfile(DEMO_PROFILE);
    }
  }, [isDemoMode, user]);

  // Handle PKCE code exchange on page load (email confirmation & password reset links)
  useEffect(() => {
    const handleAuthRedirect = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const errorParam = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      // Handle error in redirect (e.g., expired link)
      if (errorParam) {
        console.warn('[Auth] Redirect error:', errorParam, errorDescription);
        // Clean up URL
        url.searchParams.delete('error');
        url.searchParams.delete('error_description');
        window.history.replaceState({}, '', url.pathname);
        return;
      }

      // Handle PKCE code exchange
      if (code) {
        console.log('[Auth] PKCE code detected, exchanging for session...');
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[Auth] Code exchange failed:', error.message);
          } else {
            console.log('[Auth] Code exchange successful, user:', data.user?.email);
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
              // Fire signal for PKCE exchange
              fireDataFetchSignal(data.session.access_token, 'PKCE code exchange');
            }
          }
        } catch (err) {
          console.error('[Auth] Code exchange error:', err);
        }
        // Clean up URL - remove the code parameter
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.pathname + url.search);
      }

      // Also handle hash-based tokens (implicit flow fallback)
      const hash = window.location.hash;
      if (hash && (hash.includes('access_token') || hash.includes('type=recovery') || hash.includes('type=signup'))) {
        console.log('[Auth] Hash-based auth tokens detected');
        if (hash.includes('type=recovery')) {
          console.log('[Auth] Password recovery detected from hash');
          setShowPasswordReset(true);
        }
        if (hash.includes('type=signup')) {
          console.log('[Auth] Email confirmation detected from hash');
          setEmailConfirmed(true);
        }
        setTimeout(() => {
          window.history.replaceState({}, '', window.location.pathname);
        }, 1000);
      }
    };

    handleAuthRedirect();
  }, []);

  // Initialize auth - runs ONCE, completely non-blocking
  useEffect(() => {
    mountedRef.current = true;
    
    if (initRef.current) return;
    initRef.current = true;

    let authSub: { unsubscribe: () => void } | null = null;

    try {
      const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!mountedRef.current) return;
        
        console.log('[Auth] State change:', event, newSession?.user?.email || 'no user');
        
        // Use setTimeout(0) to avoid Supabase "setState during render" warning
        // but batch all state updates together so React processes them in one render
        setTimeout(() => {
          if (!mountedRef.current) return;
          
          // Handle specific auth events
          if (event === 'PASSWORD_RECOVERY') {
            console.log('[Auth] Password recovery event detected');
            setShowPasswordReset(true);
          }
          
          if (event === 'SIGNED_IN' && newSession?.user?.email_confirmed_at) {
            const confirmedAt = new Date(newSession.user.email_confirmed_at).getTime();
            const now = Date.now();
            if (now - confirmedAt < 120000) {
              console.log('[Auth] Fresh email confirmation detected');
              setEmailConfirmed(true);
            }
          }

          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            // Exit demo mode when a real user signs in
            setIsDemoMode(prev => {
              if (prev) {
                try { localStorage.removeItem(DEMO_MODE_KEY); } catch {}
              }
              return false;
            });
            
            // CRITICAL: Fire the data fetch signal on SIGNED_IN or INITIAL_SESSION
            // This tells AppContext to immediately fetch ALL data from ALL tables
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
              fireDataFetchSignal(newSession.access_token, `onAuthStateChange:${event}`);
            }
            
            ensureProfile(newSession.user.id).then(p => {
              if (mountedRef.current) setProfile(p);
            }).catch(() => {});

            // Check team membership
            checkTeamMembership(newSession.user.id).then(membership => {
              if (mountedRef.current) {
                setActiveTeamMembership(membership);
                if (membership) {
                  console.log('[Auth] Team member detected:', membership.role, 'on team:', membership.teamOwnerName);
                  fetchProfile(membership.teamOwnerId).then(() => {}).catch(() => {});
                }
              }
            }).catch(() => {});

          } else {
            // User signed out or no session
            setProfile(prev => {
              // Only clear if not in demo mode
              const inDemo = localStorage.getItem(DEMO_MODE_KEY) === 'true';
              return inDemo ? prev : null;
            });
            setActiveTeamMembership(null);
            // Reset signal tracking so next login fires fresh
            lastSignalSessionIdRef.current = null;
          }
        }, 0);
      });
      authSub = data.subscription;
    } catch (err) {
      console.warn('Auth listener setup failed:', err);
    }

    // Try to get existing session (page load / refresh)
    supabase.auth.getSession().then(({ data }) => {
      if (!mountedRef.current) return;
      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        
        // Exit demo mode if real session exists
        setIsDemoMode(prev => {
          if (prev) {
            try { localStorage.removeItem(DEMO_MODE_KEY); } catch {}
          }
          return false;
        });
        
        // Fire signal for session restore
        fireDataFetchSignal(data.session.access_token, 'getSession (page load)');
        
        fetchProfile(data.session.user.id).then(p => {
          if (mountedRef.current) setProfile(p);
        }).catch(() => {});

        // Check team membership on session restore
        checkTeamMembership(data.session.user.id).then(membership => {
          if (mountedRef.current) setActiveTeamMembership(membership);
        }).catch(() => {});
      }
    }).catch((err) => {
      console.warn('getSession failed (non-blocking):', err);
    });

    return () => {
      mountedRef.current = false;
      authSub?.unsubscribe();
    };
  }, []);


  // Sign up - returns whether confirmation is needed
  const signUp = async (email: string, password: string, teamName?: string): Promise<SignUpResult> => {
    console.log('[Auth] Signing up:', email);
    
    const redirectUrl = `${window.location.origin}`;
    console.log('[Auth] Redirect URL for confirmation:', redirectUrl);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { team_name: teamName || 'My Race Team' },
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      console.error('[Auth] Signup error:', error.message);
      return { error, needsConfirmation: false, autoConfirmed: false };
    }

    const hasSession = !!data.session;
    const hasUser = !!data.user;
    
    const identities = data.user?.identities || [];
    const hasIdentities = identities.length > 0;
    
    if (hasUser && !hasIdentities) {
      console.warn('[Auth] Signup returned user with no identities - email may already be registered');
      return { 
        error: { message: 'This email is already registered. Try signing in instead.', name: 'AuthError', status: 400 } as AuthError, 
        needsConfirmation: false, 
        autoConfirmed: false 
      };
    }

    if (hasSession) {
      console.log('[Auth] User auto-confirmed (session returned).');
      
      if (data.user && teamName) {
        try {
          await supabase
            .from('user_profiles')
            .update({ team_name: teamName })
            .eq('id', data.user.id);
        } catch (e) {
          console.warn('[Auth] Profile update after signup failed (non-blocking):', e);
        }
      }
      
      return { error: null, needsConfirmation: false, autoConfirmed: true };
    } else if (hasUser) {
      console.log('[Auth] No session returned - email confirmation required.');
      return { error: null, needsConfirmation: true, autoConfirmed: false };
    } else {
      console.warn('[Auth] Signup returned neither session nor user');
      return { error: null, needsConfirmation: true, autoConfirmed: false };
    }
  };

  // Sign in
  const signIn = async (email: string, password: string) => {
    console.log('[Auth] Signing in:', email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[Auth] Sign in error:', error.message);
    } else {
      console.log('[Auth] Sign in successful');
      if (isDemoMode) {
        setIsDemoMode(false);
        try { localStorage.removeItem(DEMO_MODE_KEY); } catch {}
      }
    }
    return { error };
  };

  // Sign out
  const signOut = async () => {
    console.log('[Auth] Signing out');
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setSession(null);
    setProfile(null);
    setActiveTeamMembership(null);
    setShowPasswordReset(false);
    setEmailConfirmed(false);
  };

  // Reset password (send email)
  const resetPassword = async (email: string) => {
    console.log('[Auth] Sending password reset to:', email);
    const redirectUrl = `${window.location.origin}`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    if (error) {
      console.error('[Auth] Password reset error:', error.message);
    }
    return { error };
  };

  // Update password (after clicking reset link)
  const updatePassword = async (newPassword: string) => {
    console.log('[Auth] Updating password');
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (!error) {
      console.log('[Auth] Password updated successfully');
      setShowPasswordReset(false);
    } else {
      console.error('[Auth] Password update error:', error.message);
    }
    return { error };
  };

  // Resend confirmation email
  const resendConfirmation = async (email: string) => {
    console.log('[Auth] Resending confirmation to:', email);
    const redirectUrl = `${window.location.origin}`;
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    if (error) {
      console.error('[Auth] Resend confirmation error:', error.message);
    }
    return { error };
  };
  // Update user profile in database
  const updateProfile = async (updates: Partial<UserProfile>): Promise<{ error: Error | null }> => {
    if (!user) {
      const err = new Error('Not authenticated — you must be signed in to save your profile.');
      console.error('[Auth] updateProfile:', err.message);
      return { error: err };
    }

    try {
      // Build the full payload — include ALL fields, converting undefined/null to null for DB
      const payload: Record<string, any> = {
        team_name: updates.teamName ?? null,
        driver_name: updates.driverName ?? null,
        driver_license_number: updates.driverLicenseNumber ?? null,
        driver_license_class: updates.driverLicenseClass ?? null,
        driver_license_expiration: updates.driverLicenseExpiration || null,
        driver_licenses: updates.driverLicenses !== undefined ? JSON.stringify(updates.driverLicenses) : undefined,
        car_name: updates.carName ?? null,
        car_number: updates.carNumber ?? null,
        car_class: updates.carClass ?? null,
        car_make: updates.carMake ?? null,
        car_model: updates.carModel ?? null,
        car_year: updates.carYear ? Number(updates.carYear) : null,
        car_weight: updates.carWeight ? Number(updates.carWeight) : null,
        engine_type: updates.engineType ?? null,
        fuel_type: updates.fuelType ?? null,
        home_track: updates.homeTrack ?? null,
        team_logo_url: updates.teamLogoUrl ?? null,
        contact_email: updates.contactEmail ?? null,
        contact_phone: updates.contactPhone ?? null,
        notes: updates.notes ?? null,
        updated_at: new Date().toISOString(),
      };

      // Remove undefined keys so they don't overwrite existing data
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) delete payload[key];
      });



      // Ensure team_name is never null (DB has NOT NULL or default)
      if (!payload.team_name) payload.team_name = 'My Race Team';

      console.log('[Auth] updateProfile payload:', JSON.stringify(payload, null, 2));

      // Use UPSERT with the user's auth ID as both id and user_id
      // This handles both cases: row exists (update) or row doesn't exist (insert)
      const upsertPayload = {
        id: user.id,
        user_id: user.id,
        ...payload,
      };

      const { data: upsertData, error: upsertError } = await supabase
        .from('user_profiles')
        .upsert(upsertPayload, { onConflict: 'user_id' })
        .select('*')
        .maybeSingle();

      if (upsertError) {
        console.error('[Auth] Upsert by user_id failed:', upsertError.message, upsertError.details, upsertError.hint);
        
        // Fallback: try upsert on id column
        const { data: upsertData2, error: upsertError2 } = await supabase
          .from('user_profiles')
          .upsert({ id: user.id, user_id: user.id, ...payload }, { onConflict: 'id' })
          .select('*')
          .maybeSingle();

        if (upsertError2) {
          console.error('[Auth] Upsert by id also failed:', upsertError2.message, upsertError2.details, upsertError2.hint);
          
          // Last resort: plain update by user_id, then by id
          const { error: updateErr1 } = await supabase
            .from('user_profiles')
            .update(payload)
            .eq('user_id', user.id);
          
          if (updateErr1) {
            console.error('[Auth] Update by user_id failed:', updateErr1.message);
            const { error: updateErr2 } = await supabase
              .from('user_profiles')
              .update(payload)
              .eq('id', user.id);
            
            if (updateErr2) {
              const errMsg = `Profile save failed: ${updateErr2.message}. Details: ${updateErr2.details || 'none'}. Hint: ${updateErr2.hint || 'none'}`;
              console.error('[Auth]', errMsg);
              throw new Error(errMsg);
            }
          }
        } else if (upsertData2) {
          console.log('[Auth] Profile saved via upsert on id');
          setProfile(toUserProfile(upsertData2));
          return { error: null };
        }
      } else if (upsertData) {
        console.log('[Auth] Profile saved via upsert on user_id');
        setProfile(toUserProfile(upsertData));
        return { error: null };
      }

      // If we got here via the update fallback path, re-fetch the profile
      console.log('[Auth] Re-fetching profile after update...');
      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) {
        setProfile(updatedProfile);
        console.log('[Auth] Profile re-fetched successfully');
      } else {
        console.warn('[Auth] Could not re-fetch profile after save');
      }
      return { error: null };
    } catch (error: any) {
      console.error('[Auth] updateProfile exception:', error);
      return { error: error instanceof Error ? error : new Error(String(error?.message || error)) };
    }
  };



  // Refresh profile
  const refreshProfile = async () => {
    if (user) {
      const userProfile = await fetchProfile(user.id);
      setProfile(userProfile);
    }
  };

  // Demo mode controls
  const enableDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setProfile(DEMO_PROFILE);
    try { localStorage.setItem(DEMO_MODE_KEY, 'true'); } catch {}
  }, []);

  const disableDemoMode = useCallback(() => {
    setIsDemoMode(false);
    if (!user) {
      setProfile(null);
    }
    try { localStorage.removeItem(DEMO_MODE_KEY); } catch {}
  }, [user]);

  const clearEmailConfirmed = useCallback(() => {
    setEmailConfirmed(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isLoading,
      isAuthenticated: !!user || isDemoMode,
      isDemoMode,
      showPasswordReset,
      emailConfirmed,
      activeTeamMembership,
      isTeamMember,
      effectiveUserId,
      dataFetchSignal,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      resendConfirmation,
      updateProfile,
      refreshProfile,
      enableDemoMode,
      disableDemoMode,
      setShowPasswordReset,
      clearEmailConfirmed
    }}>
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
