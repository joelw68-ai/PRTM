// Audit Log Service for Professional Racing Management
// Tracks all changes made in the app for accountability

import { supabase } from './supabase';
import { parseRows } from './validatedQuery';
import { AuditLogRowSchema } from './validators';
import { CrewRole } from './permissions';


// ============ TYPES ============

export type AuditActionType = 
  | 'create'
  | 'update'
  | 'delete'
  | 'check'
  | 'uncheck'
  | 'reset'
  | 'login'
  | 'logout'
  | 'role_change'
  | 'export'
  | 'import'
  | 'swap';

export type AuditCategory = 
  | 'checklist'
  | 'passlog'
  | 'engine'
  | 'supercharger'
  | 'cylinderhead'
  | 'maintenance'
  | 'sfi'
  | 'parts'
  | 'workorder'
  | 'team'
  | 'settings'
  | 'calendar'
  | 'analytics'
  | 'auth'
  | 'media'
  | 'todo';




export type AuditEntityType = 
  | 'checklist_item'
  | 'checklist'
  | 'pass_log'
  | 'engine'
  | 'supercharger'
  | 'cylinder_head'
  | 'maintenance_item'
  | 'sfi_certification'
  | 'part'
  | 'work_order'
  | 'team_member'
  | 'team_profile'
  | 'race_event'
  | 'setup'
  | 'note'
  | 'user'
  | 'photo'
  | 'video'
  | 'todo_item';




export interface AuditLogEntry {
  id?: string;
  timestamp?: string;
  user_id: string;
  user_name: string;
  user_role: CrewRole;
  action_type: AuditActionType;
  category: AuditCategory;
  entity_type: AuditEntityType;
  entity_id?: string;
  entity_name?: string;
  description: string;
  before_value?: Record<string, any> | null;
  after_value?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface AuditLogFilter {
  startDate?: string;
  endDate?: string;
  userId?: string;
  category?: AuditCategory;
  actionType?: AuditActionType;
  entityType?: AuditEntityType;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

// ============ AUDIT LOG SERVICE ============

class AuditLogService {
  private currentUser: { id: string; name: string; role: CrewRole } | null = null;

  /**
   * Set the current user for audit logging
   */
  setCurrentUser(user: { id: string; name: string; role: CrewRole }) {
    this.currentUser = user;
  }

  /**
   * Get the current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Log an action to the audit log
   */
  async log(entry: Omit<AuditLogEntry, 'user_id' | 'user_name' | 'user_role'>): Promise<boolean> {
    try {
      const user = this.currentUser || { 
        id: 'unknown', 
        name: 'Unknown User', 
        role: 'Guest' as CrewRole 
      };

      const logEntry: AuditLogEntry = {
        ...entry,
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
      };

      const { error } = await supabase
        .from('audit_logs')
        .insert([logEntry]);

      if (error) {
        console.error('Error logging audit entry:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error in audit log:', err);
      return false;
    }
  }

  /**
   * Log a checklist item check/uncheck
   */
  async logChecklistCheck(
    itemId: string,
    itemName: string,
    checklistName: string,
    checked: boolean
  ) {
    return this.log({
      action_type: checked ? 'check' : 'uncheck',
      category: 'checklist',
      entity_type: 'checklist_item',
      entity_id: itemId,
      entity_name: itemName,
      description: `${checked ? 'Checked' : 'Unchecked'} "${itemName}" in ${checklistName}`,
      after_value: { checked, checklistName }
    });
  }

  /**
   * Log a checklist reset
   */
  async logChecklistReset(checklistId: string, checklistName: string, itemCount: number) {
    return this.log({
      action_type: 'reset',
      category: 'checklist',
      entity_type: 'checklist',
      entity_id: checklistId,
      entity_name: checklistName,
      description: `Reset checklist "${checklistName}" (${itemCount} items)`,
      metadata: { itemCount }
    });
  }

  /**
   * Log a checklist item creation
   */
  async logChecklistItemCreate(itemId: string, itemName: string, checklistName: string, data: any) {
    return this.log({
      action_type: 'create',
      category: 'checklist',
      entity_type: 'checklist_item',
      entity_id: itemId,
      entity_name: itemName,
      description: `Added checklist item "${itemName}" to ${checklistName}`,
      after_value: data
    });
  }

  /**
   * Log a checklist item update
   */
  async logChecklistItemUpdate(itemId: string, itemName: string, before: any, after: any) {
    return this.log({
      action_type: 'update',
      category: 'checklist',
      entity_type: 'checklist_item',
      entity_id: itemId,
      entity_name: itemName,
      description: `Updated checklist item "${itemName}"`,
      before_value: before,
      after_value: after
    });
  }

  /**
   * Log a checklist item deletion
   */
  async logChecklistItemDelete(itemId: string, itemName: string, checklistName: string) {
    return this.log({
      action_type: 'delete',
      category: 'checklist',
      entity_type: 'checklist_item',
      entity_id: itemId,
      entity_name: itemName,
      description: `Deleted checklist item "${itemName}" from ${checklistName}`
    });
  }

  /**
   * Log an inventory change
   */
  async logInventoryChange(
    partId: string,
    partName: string,
    actionType: AuditActionType,
    before?: any,
    after?: any
  ) {
    const descriptions: Record<AuditActionType, string> = {
      create: `Added part "${partName}" to inventory`,
      update: `Updated part "${partName}"`,
      delete: `Removed part "${partName}" from inventory`,
      check: '',
      uncheck: '',
      reset: '',
      login: '',
      logout: '',
      role_change: '',
      export: '',
      import: '',
      swap: ''
    };

    return this.log({
      action_type: actionType,
      category: 'parts',
      entity_type: 'part',
      entity_id: partId,
      entity_name: partName,
      description: descriptions[actionType] || `${actionType} part "${partName}"`,
      before_value: before,
      after_value: after
    });
  }

  /**
   * Log a team member role change
   */
  async logRoleChange(
    memberId: string,
    memberName: string,
    oldRole: string,
    newRole: string
  ) {
    return this.log({
      action_type: 'role_change',
      category: 'team',
      entity_type: 'team_member',
      entity_id: memberId,
      entity_name: memberName,
      description: `Changed ${memberName}'s role from ${oldRole} to ${newRole}`,
      before_value: { role: oldRole },
      after_value: { role: newRole }
    });
  }

  /**
   * Log a team member addition
   */
  async logTeamMemberAdd(memberId: string, memberName: string, role: string, data: any) {
    return this.log({
      action_type: 'create',
      category: 'team',
      entity_type: 'team_member',
      entity_id: memberId,
      entity_name: memberName,
      description: `Added team member "${memberName}" as ${role}`,
      after_value: data
    });
  }

  /**
   * Log a team member removal
   */
  async logTeamMemberRemove(memberId: string, memberName: string) {
    return this.log({
      action_type: 'delete',
      category: 'team',
      entity_type: 'team_member',
      entity_id: memberId,
      entity_name: memberName,
      description: `Removed team member "${memberName}"`
    });
  }

  /**
   * Log a settings change
   */
  async logSettingsChange(settingName: string, before: any, after: any) {
    return this.log({
      action_type: 'update',
      category: 'settings',
      entity_type: 'team_profile',
      entity_name: settingName,
      description: `Updated setting "${settingName}"`,
      before_value: before,
      after_value: after
    });
  }

  /**
   * Log a pass log entry
   */
  async logPassLogEntry(
    passId: string,
    actionType: AuditActionType,
    passNumber: number,
    data?: any,
    before?: any
  ) {
    const descriptions: Record<string, string> = {
      create: `Added pass log #${passNumber}`,
      update: `Updated pass log #${passNumber}`,
      delete: `Deleted pass log #${passNumber}`
    };

    return this.log({
      action_type: actionType,
      category: 'passlog',
      entity_type: 'pass_log',
      entity_id: passId,
      entity_name: `Pass #${passNumber}`,
      description: descriptions[actionType] || `${actionType} pass log #${passNumber}`,
      before_value: before,
      after_value: data
    });
  }

  /**
   * Log an engine change
   */
  async logEngineChange(
    engineId: string,
    engineName: string,
    actionType: AuditActionType,
    before?: any,
    after?: any
  ) {
    const descriptions: Record<string, string> = {
      create: `Added engine "${engineName}"`,
      update: `Updated engine "${engineName}"`,
      delete: `Removed engine "${engineName}"`,
      swap: `Swapped engine to "${engineName}"`
    };

    return this.log({
      action_type: actionType,
      category: 'engine',
      entity_type: 'engine',
      entity_id: engineId,
      entity_name: engineName,
      description: descriptions[actionType] || `${actionType} engine "${engineName}"`,
      before_value: before,
      after_value: after
    });
  }

  /**
   * Log a maintenance item change
   */
  async logMaintenanceChange(
    itemId: string,
    itemName: string,
    actionType: AuditActionType,
    before?: any,
    after?: any
  ) {
    return this.log({
      action_type: actionType,
      category: 'maintenance',
      entity_type: 'maintenance_item',
      entity_id: itemId,
      entity_name: itemName,
      description: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}d maintenance item "${itemName}"`,
      before_value: before,
      after_value: after
    });
  }

  /**
   * Log an SFI certification change
   */
  async logSFIChange(
    certId: string,
    certName: string,
    actionType: AuditActionType,
    before?: any,
    after?: any
  ) {
    return this.log({
      action_type: actionType,
      category: 'sfi',
      entity_type: 'sfi_certification',
      entity_id: certId,
      entity_name: certName,
      description: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}d SFI certification "${certName}"`,
      before_value: before,
      after_value: after
    });
  }

  /**
   * Log a calendar event change
   */
  async logCalendarChange(
    eventId: string,
    eventName: string,
    actionType: AuditActionType,
    before?: any,
    after?: any
  ) {
    return this.log({
      action_type: actionType,
      category: 'calendar',
      entity_type: 'race_event',
      entity_id: eventId,
      entity_name: eventName,
      description: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}d race event "${eventName}"`,
      before_value: before,
      after_value: after
    });
  }

  /**
   * Log a data export
   */
  async logDataExport(exportType: string, recordCount: number) {
    return this.log({
      action_type: 'export',
      category: 'analytics',
      entity_type: 'pass_log',
      entity_name: exportType,
      description: `Exported ${recordCount} ${exportType} records`,
      metadata: { recordCount, exportType }
    });
  }

  /**
   * Fetch audit logs with filters
   */
  async fetchLogs(filters: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.actionType) {
        query = query.eq('action_type', filters.actionType);
      }
      if (filters.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters.searchTerm) {
        query = query.or(`description.ilike.%${filters.searchTerm}%,entity_name.ilike.%${filters.searchTerm}%`);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        return [];
      }

      return parseRows(data, AuditLogRowSchema, 'audit_logs') as AuditLogEntry[];

    } catch (err) {
      console.error('Error in fetchLogs:', err);
      return [];
    }
  }

  /**
   * Get audit log statistics
   */
  async getStats(days: number = 7): Promise<{
    totalActions: number;
    actionsByCategory: Record<string, number>;
    actionsByUser: Record<string, number>;
    actionsByType: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.fetchLogs({
      startDate: startDate.toISOString(),
      limit: 1000
    });

    const stats = {
      totalActions: logs.length,
      actionsByCategory: {} as Record<string, number>,
      actionsByUser: {} as Record<string, number>,
      actionsByType: {} as Record<string, number>
    };

    logs.forEach(log => {
      // By category
      stats.actionsByCategory[log.category] = (stats.actionsByCategory[log.category] || 0) + 1;
      // By user
      stats.actionsByUser[log.user_name] = (stats.actionsByUser[log.user_name] || 0) + 1;
      // By type
      stats.actionsByType[log.action_type] = (stats.actionsByType[log.action_type] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance
export const auditLog = new AuditLogService();

// Export helper to format audit log entries for display
export function formatAuditLogEntry(entry: AuditLogEntry): {
  icon: string;
  color: string;
  timeAgo: string;
} {
  const actionColors: Record<AuditActionType, string> = {
    create: 'text-green-400',
    update: 'text-blue-400',
    delete: 'text-red-400',
    check: 'text-green-400',
    uncheck: 'text-yellow-400',
    reset: 'text-orange-400',
    login: 'text-cyan-400',
    logout: 'text-slate-400',
    role_change: 'text-purple-400',
    export: 'text-blue-400',
    import: 'text-green-400',
    swap: 'text-orange-400'
  };

  const actionIcons: Record<AuditActionType, string> = {
    create: '+',
    update: '~',
    delete: '-',
    check: '✓',
    uncheck: '○',
    reset: '↺',
    login: '→',
    logout: '←',
    role_change: '⇄',
    export: '↓',
    import: '↑',
    swap: '⇆'
  };

  // Calculate time ago
  const timestamp = new Date(entry.timestamp || new Date());
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeAgo = '';
  if (diffMins < 1) {
    timeAgo = 'Just now';
  } else if (diffMins < 60) {
    timeAgo = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    timeAgo = `${diffHours}h ago`;
  } else if (diffDays < 7) {
    timeAgo = `${diffDays}d ago`;
  } else {
    timeAgo = timestamp.toLocaleDateString();
  }

  return {
    icon: actionIcons[entry.action_type] || '•',
    color: actionColors[entry.action_type] || 'text-slate-400',
    timeAgo
  };
}

// Category labels for display
export const categoryLabels: Record<AuditCategory, string> = {
  checklist: 'Checklists',
  passlog: 'Pass Logs',
  engine: 'Main Components',

  supercharger: 'Superchargers',
  cylinderhead: 'Cylinder Heads',
  maintenance: 'Maintenance',
  sfi: 'SFI Certs',
  parts: 'Parts Inventory',
  workorder: 'Work Orders',
  team: 'Team',
  settings: 'Settings',
  calendar: 'Calendar',
  analytics: 'Analytics',
  auth: 'Authentication',
  media: 'Media Gallery',
  todo: 'To Do List'
};


// Action type labels for display
export const actionTypeLabels: Record<AuditActionType, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  check: 'Checked',
  uncheck: 'Unchecked',
  reset: 'Reset',
  login: 'Logged In',
  logout: 'Logged Out',
  role_change: 'Role Changed',
  export: 'Exported',
  import: 'Imported',
  swap: 'Swapped'
};
