// Team Membership & Invite Operations
// IMPORTANT: This module NEVER queries auth.users directly.
// All operations use team_invites and team_memberships tables only.
import { supabase } from './supabase';
import { parseRows } from './validatedQuery';
import { TeamInviteRowSchema, TeamMembershipRowSchema, PartsUsageLogRowSchema } from './validators';

export interface TeamInvite {
  id: string;
  teamOwnerId: string;
  email: string;
  role: string;
  permissions: string[];
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitedByName: string;
  teamName: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface TeamMembership {
  id: string;
  teamOwnerId: string;
  memberUserId: string;
  teamMemberId?: string;
  role: string;
  permissions: string[];
  status: 'active' | 'suspended' | 'removed';
  joinedAt: string;
  inviteId?: string;
}

const toTeamInvite = (row: any): TeamInvite => ({
  id: row.id,
  teamOwnerId: row.team_owner_id,
  email: row.email,
  role: row.role || 'Crew',
  permissions: row.permissions || ['view'],
  token: row.token,
  status: row.status || 'pending',
  invitedByName: row.invited_by_name || '',
  teamName: row.team_name || '',
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  acceptedAt: row.accepted_at
});

const toTeamMembership = (row: any): TeamMembership => ({
  id: row.id,
  teamOwnerId: row.team_owner_id,
  memberUserId: row.member_user_id,
  teamMemberId: row.team_member_id,
  role: row.role || 'Crew',
  permissions: row.permissions || ['view'],
  status: row.status || 'active',
  joinedAt: row.joined_at,
  inviteId: row.invite_id
});

// ============ INVITE OPERATIONS ============

export const fetchTeamInvites = async (userId: string): Promise<TeamInvite[]> => {
  const { data, error } = await supabase
    .from('team_invites')
    .select('*')
    .eq('team_owner_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('fetchTeamInvites error:', error.message, error.details, error.hint);
    throw error;
  }
  return parseRows(data, TeamInviteRowSchema, 'team_invites').map(toTeamInvite);
};

/**
 * Create a team invite.
 * - Generates a unique token client-side
 * - Explicitly sets team_owner_id (the current user's auth ID)
 * - Explicitly sets expires_at (7 days from now)
 * - Does NOT query auth.users at all
 * - Returns the invite record and a shareable link in /invite/TOKEN format
 */
export const sendTeamInvite = async (params: {
  email: string;
  role: string;
  permissions: string[];
  teamName: string;
  invitedByName: string;
}): Promise<{ invite: TeamInvite; inviteLink: string }> => {
  // Get the current user's ID without querying auth.users
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('You must be signed in to send invitations');
  }

  // Generate a unique token client-side
  const token = crypto.randomUUID();
  
  // Calculate expiry: 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Build the invite link using path format: /invite/TOKEN
  const inviteLink = `${window.location.origin}/invite/${token}`;

  // Generate a unique ID for the invite record
  const inviteId = crypto.randomUUID();

  // Insert the invite record with ALL fields explicitly set
  // This avoids any DEFAULT expressions that might reference auth.users
  const { data, error } = await supabase
    .from('team_invites')
    .insert({
      id: inviteId,                          // Explicitly set — never null
      team_owner_id: user.id,                // Explicitly set — no DEFAULT needed
      email: params.email,
      role: params.role,
      permissions: params.permissions,
      token: token,                          // Explicitly set — never null
      status: 'pending',
      invited_by_name: params.invitedByName,
      team_name: params.teamName,
      expires_at: expiresAt.toISOString(),   // Explicitly set — no DEFAULT needed
    })

    .select()
    .single();

  if (error) {
    console.error('sendTeamInvite error:', error.message, error.details, error.hint, error.code);
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  return { invite: toTeamInvite(data), inviteLink };
};


export const revokeTeamInvite = async (inviteId: string): Promise<void> => {
  const { error } = await supabase
    .from('team_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId);
  
  if (error) {
    console.error('revokeTeamInvite error:', error.message);
    throw error;
  }
};

/**
 * Get an invite by its token.
 * Only returns pending invites that haven't expired.
 * Does NOT query auth.users.
 */
export const getInviteByToken = async (token: string): Promise<TeamInvite | null> => {
  const { data, error } = await supabase
    .from('team_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  
  if (error) {
    console.error('getInviteByToken error:', error.message);
    throw error;
  }
  if (!data) return null;
  
  const invite = toTeamInvite(data);
  
  // Check if expired
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    // Auto-mark as expired
    await supabase.from('team_invites').update({ status: 'expired' }).eq('id', invite.id);
    return { ...invite, status: 'expired' };
  }
  
  return invite;
};

/**
 * Accept an invite.
 * - Looks up the invite by token
 * - Creates a team_memberships row
 * - Updates the invite status to 'accepted'
 * - Does NOT query auth.users
 */
export const acceptInvite = async (token: string, userId: string): Promise<TeamMembership> => {
  // Get the invite
  const invite = await getInviteByToken(token);
  if (!invite) throw new Error('Invite not found or has been revoked');
  
  // CRITICAL: Prevent the team owner from accepting their own invite.
  // This would create a self-referencing membership row that causes the owner
  // to be incorrectly treated as a crew member with restricted access.
  if (invite.teamOwnerId === userId) {
    throw new Error('You cannot accept an invite to your own team. You are already the owner of this team.');
  }

  // Check status
  if (invite.status === 'expired') {
    throw new Error('This invitation has expired. Please ask the team owner to send a new one.');
  }
  if (invite.status === 'revoked') {
    throw new Error('This invitation has been revoked.');
  }
  if (invite.status === 'accepted') {
    throw new Error('This invitation has already been accepted.');
  }
  if (invite.status !== 'pending') {
    throw new Error(`This invitation is no longer valid (status: ${invite.status}).`);
  }
  
  // Check if invite is expired by date
  if (new Date(invite.expiresAt) < new Date()) {
    await supabase.from('team_invites').update({ status: 'expired' }).eq('id', invite.id);
    throw new Error('This invitation has expired. Please ask the team owner to send a new one.');
  }

  // Check if user is already a member of this team
  const { data: existingMembership } = await supabase
    .from('team_memberships')
    .select('id')
    .eq('team_owner_id', invite.teamOwnerId)
    .eq('member_user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  
  if (existingMembership) {
    throw new Error('You are already a member of this team.');
  }



  // Create the membership — explicitly set all fields including id, no auth.users dependency
  const membershipId = crypto.randomUUID();
  const { data: membership, error: memberError } = await supabase
    .from('team_memberships')
    .insert({
      id: membershipId,                    // Explicitly set — never null
      team_owner_id: invite.teamOwnerId,
      member_user_id: userId,
      role: invite.role,
      permissions: invite.permissions,
      status: 'active',
      invite_id: invite.id
    })

    .select()
    .single();
  
  if (memberError) {
    console.error('acceptInvite membership error:', memberError.message, memberError.details, memberError.hint);
    if (memberError.code === '23505') {
      throw new Error('You are already a member of this team.');
    }
    throw new Error(`Failed to join team: ${memberError.message}`);
  }

  // Update invite status to accepted
  const { error: updateError } = await supabase
    .from('team_invites')
    .update({ 
      status: 'accepted', 
      accepted_at: new Date().toISOString() 
    })
    .eq('id', invite.id);
  
  if (updateError) {
    console.warn('Failed to update invite status:', updateError.message);
    // Non-fatal — the membership was created successfully
  }

  return toTeamMembership(membership);
};

// ============ MEMBERSHIP OPERATIONS ============

export const fetchTeamMemberships = async (userId: string): Promise<TeamMembership[]> => {
  const { data, error } = await supabase
    .from('team_memberships')
    .select('*')
    .eq('team_owner_id', userId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });
  
  if (error) throw error;
  return parseRows(data, TeamMembershipRowSchema, 'team_memberships').map(toTeamMembership);
};

// Get teams that the current user is a member of (not owner)
// CRITICAL: Excludes self-referencing memberships where the user is both owner and member
export const fetchMyTeamMemberships = async (userId: string): Promise<TeamMembership[]> => {
  const { data, error } = await supabase
    .from('team_memberships')
    .select('*')
    .eq('member_user_id', userId)
    .neq('team_owner_id', userId)   // ← Exclude self-referencing memberships
    .eq('status', 'active')
    .order('joined_at', { ascending: false });
  
  if (error) throw error;
  return parseRows(data, TeamMembershipRowSchema, 'team_memberships').map(toTeamMembership);
};


export const updateMembershipRole = async (membershipId: string, role: string, permissions: string[]): Promise<void> => {
  const { error } = await supabase
    .from('team_memberships')
    .update({ role, permissions })
    .eq('id', membershipId);
  
  if (error) throw error;
};

export const removeMembership = async (membershipId: string): Promise<void> => {
  const { error } = await supabase
    .from('team_memberships')
    .update({ status: 'removed' })
    .eq('id', membershipId);
  
  if (error) throw error;
};

// ============ PARTS USAGE LOG OPERATIONS ============

export interface PartsUsageRecord {
  id: string;
  partId: string;
  partNumber: string;
  partDescription: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  usageDate: string;
  usageType: 'work_order' | 'maintenance';
  relatedId?: string;
  relatedTitle?: string;
  notes?: string;
  recordedBy?: string;
  previousOnHand: number;
  newOnHand: number;
  createdAt: string;
}

const toPartsUsageRecord = (row: any): PartsUsageRecord => ({
  id: row.id,
  partId: row.part_id,
  partNumber: row.part_number,
  partDescription: row.part_description || '',
  quantityUsed: row.quantity_used || 0,
  unitCost: parseFloat(row.unit_cost) || 0,
  totalCost: parseFloat(row.total_cost) || 0,
  usageDate: row.usage_date,
  usageType: row.usage_type,
  relatedId: row.related_id,
  relatedTitle: row.related_title,
  notes: row.notes,
  recordedBy: row.recorded_by,
  previousOnHand: row.previous_on_hand || 0,
  newOnHand: row.new_on_hand || 0,
  createdAt: row.created_at
});

export const fetchPartsUsageLog = async (userId?: string): Promise<PartsUsageRecord[]> => {
  const { data, error } = await supabase
    .from('parts_usage_log')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return parseRows(data, PartsUsageLogRowSchema, 'parts_usage_log').map(toPartsUsageRecord);
};

export const insertPartsUsage = async (record: Omit<PartsUsageRecord, 'id' | 'createdAt'>, userId?: string): Promise<void> => {
  const payload: any = {
    part_id: record.partId,
    part_number: record.partNumber,
    part_description: record.partDescription,
    quantity_used: record.quantityUsed,
    unit_cost: record.unitCost,
    total_cost: record.totalCost,
    usage_date: record.usageDate,
    usage_type: record.usageType,
    related_id: record.relatedId || null,
    related_title: record.relatedTitle || null,
    notes: record.notes || null,
    recorded_by: record.recordedBy || null,
    previous_on_hand: record.previousOnHand,
    new_on_hand: record.newOnHand
  };
  
  if (userId) payload.user_id = userId;
  
  const { error } = await supabase.from('parts_usage_log').insert(payload);
  if (error) throw error;
};

export const deletePartsUsage = async (id: string): Promise<void> => {
  const { error } = await supabase.from('parts_usage_log').delete().eq('id', id);
  if (error) throw error;
};
