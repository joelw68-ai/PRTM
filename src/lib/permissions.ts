// Role-Based Access Control (RBAC) System for Professional Racing Management

// ============ ROLE DEFINITIONS ============

export type CrewRole = 
  | 'Admin'
  | 'Owner'
  | 'Crew Chief'
  | 'Driver'
  | 'Tuner'
  | 'Mechanic'
  | 'Crew'
  | 'Sponsor'
  | 'Guest';

// ============ PERMISSION DEFINITIONS ============

export type Permission =
  // Checklist permissions
  | 'checklist.view'
  | 'checklist.check'
  | 'checklist.edit'
  | 'checklist.delete'
  | 'checklist.reset'
  
  // Pass log permissions
  | 'passlog.view'
  | 'passlog.add'
  | 'passlog.edit'
  | 'passlog.delete'
  
  // Engine/Component permissions
  | 'engine.view'
  | 'engine.add'
  | 'engine.edit'
  | 'engine.delete'
  | 'engine.swap'
  
  // Supercharger permissions
  | 'supercharger.view'
  | 'supercharger.add'
  | 'supercharger.edit'
  | 'supercharger.delete'
  
  // Cylinder head permissions
  | 'cylinderhead.view'
  | 'cylinderhead.add'
  | 'cylinderhead.edit'
  | 'cylinderhead.delete'
  
  // Maintenance permissions
  | 'maintenance.view'
  | 'maintenance.add'
  | 'maintenance.edit'
  | 'maintenance.delete'
  
  // SFI Certification permissions
  | 'sfi.view'
  | 'sfi.add'
  | 'sfi.edit'
  | 'sfi.delete'
  
  // Parts inventory permissions
  | 'parts.view'
  | 'parts.add'
  | 'parts.edit'
  | 'parts.delete'
  
  // Work order permissions
  | 'workorder.view'
  | 'workorder.add'
  | 'workorder.edit'
  | 'workorder.delete'
  
  // Team management permissions
  | 'team.view'
  | 'team.add'
  | 'team.edit'
  | 'team.delete'
  | 'team.manage_roles'
  
  // Settings permissions
  | 'settings.view'
  | 'settings.edit'
  | 'settings.admin'
  
  // Race calendar permissions
  | 'calendar.view'
  | 'calendar.add'
  | 'calendar.edit'
  | 'calendar.delete'
  
  // Analytics permissions
  | 'analytics.view'
  | 'analytics.export'
  
  // To Do List permissions
  | 'todo.view'
  | 'todo.add'
  | 'todo.edit'
  | 'todo.delete'
  | 'todo.complete'
  | 'todo.assign'
  | 'todo.manage';


// ============ ROLE PERMISSION MAPPINGS ============

export const rolePermissions: Record<CrewRole, Permission[]> = {
  Admin: [
    // Full access to everything
    'checklist.view', 'checklist.check', 'checklist.edit', 'checklist.delete', 'checklist.reset',
    'passlog.view', 'passlog.add', 'passlog.edit', 'passlog.delete',
    'engine.view', 'engine.add', 'engine.edit', 'engine.delete', 'engine.swap',
    'supercharger.view', 'supercharger.add', 'supercharger.edit', 'supercharger.delete',
    'cylinderhead.view', 'cylinderhead.add', 'cylinderhead.edit', 'cylinderhead.delete',
    'maintenance.view', 'maintenance.add', 'maintenance.edit', 'maintenance.delete',
    'sfi.view', 'sfi.add', 'sfi.edit', 'sfi.delete',
    'parts.view', 'parts.add', 'parts.edit', 'parts.delete',
    'workorder.view', 'workorder.add', 'workorder.edit', 'workorder.delete',
    'team.view', 'team.add', 'team.edit', 'team.delete', 'team.manage_roles',
    'settings.view', 'settings.edit', 'settings.admin',
    'calendar.view', 'calendar.add', 'calendar.edit', 'calendar.delete',
    'analytics.view', 'analytics.export',
    'todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete', 'todo.assign', 'todo.manage'
  ],

  
  Owner: [
    // Full access except some admin-only features
    'checklist.view', 'checklist.check', 'checklist.edit', 'checklist.delete', 'checklist.reset',
    'passlog.view', 'passlog.add', 'passlog.edit', 'passlog.delete',
    'engine.view', 'engine.add', 'engine.edit', 'engine.delete', 'engine.swap',
    'supercharger.view', 'supercharger.add', 'supercharger.edit', 'supercharger.delete',
    'cylinderhead.view', 'cylinderhead.add', 'cylinderhead.edit', 'cylinderhead.delete',
    'maintenance.view', 'maintenance.add', 'maintenance.edit', 'maintenance.delete',
    'sfi.view', 'sfi.add', 'sfi.edit', 'sfi.delete',
    'parts.view', 'parts.add', 'parts.edit', 'parts.delete',
    'workorder.view', 'workorder.add', 'workorder.edit', 'workorder.delete',
    'team.view', 'team.add', 'team.edit', 'team.delete', 'team.manage_roles',
    'settings.view', 'settings.edit',
    'calendar.view', 'calendar.add', 'calendar.edit', 'calendar.delete',
    'analytics.view', 'analytics.export',
    'todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete', 'todo.assign', 'todo.manage'
  ],
  
  'Crew Chief': [
    // Can edit most things but not manage team roles - Full todo access
    'checklist.view', 'checklist.check', 'checklist.edit', 'checklist.delete', 'checklist.reset',
    'passlog.view', 'passlog.add', 'passlog.edit',
    'engine.view', 'engine.add', 'engine.edit', 'engine.swap',
    'supercharger.view', 'supercharger.add', 'supercharger.edit',
    'cylinderhead.view', 'cylinderhead.add', 'cylinderhead.edit',
    'maintenance.view', 'maintenance.add', 'maintenance.edit', 'maintenance.delete',
    'sfi.view', 'sfi.add', 'sfi.edit',
    'parts.view', 'parts.add', 'parts.edit',
    'workorder.view', 'workorder.add', 'workorder.edit',
    'team.view', 'team.add', 'team.edit',
    'settings.view', 'settings.edit',
    'calendar.view', 'calendar.add', 'calendar.edit',
    'analytics.view', 'analytics.export',
    'todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete', 'todo.assign', 'todo.manage'
  ],
  
  Driver: [
    // Can view everything, add pass logs, check checklists - Basic todo access
    'checklist.view', 'checklist.check',
    'passlog.view', 'passlog.add', 'passlog.edit',
    'engine.view',
    'supercharger.view',
    'cylinderhead.view',
    'maintenance.view',
    'sfi.view',
    'parts.view',
    'workorder.view', 'workorder.add',
    'team.view',
    'settings.view',
    'calendar.view', 'calendar.add',
    'analytics.view',
    'todo.view', 'todo.add', 'todo.edit', 'todo.complete'
  ],
  
  Tuner: [
    // Focus on engine/setup related items - Full todo access
    'checklist.view', 'checklist.check',
    'passlog.view', 'passlog.add', 'passlog.edit',
    'engine.view', 'engine.edit',
    'supercharger.view', 'supercharger.edit',
    'cylinderhead.view', 'cylinderhead.edit',
    'maintenance.view', 'maintenance.edit',
    'sfi.view',
    'parts.view', 'parts.edit',
    'workorder.view', 'workorder.add',
    'team.view',
    'settings.view',
    'calendar.view',
    'analytics.view', 'analytics.export',
    'todo.view', 'todo.add', 'todo.edit', 'todo.delete', 'todo.complete', 'todo.assign', 'todo.manage'
  ],
  
  Mechanic: [
    // Focus on maintenance and parts - Basic todo access
    'checklist.view', 'checklist.check',
    'passlog.view',
    'engine.view', 'engine.edit',
    'supercharger.view', 'supercharger.edit',
    'cylinderhead.view', 'cylinderhead.edit',
    'maintenance.view', 'maintenance.add', 'maintenance.edit',
    'sfi.view', 'sfi.edit',
    'parts.view', 'parts.add', 'parts.edit',
    'workorder.view', 'workorder.add', 'workorder.edit',
    'team.view',
    'settings.view',
    'calendar.view',
    'analytics.view',
    'todo.view', 'todo.add', 'todo.edit', 'todo.complete'
  ],
  
  Crew: [
    // Basic crew member - can check checklists and view most things - Basic todo access
    'checklist.view', 'checklist.check',
    'passlog.view',
    'engine.view',
    'supercharger.view',
    'cylinderhead.view',
    'maintenance.view',
    'sfi.view',
    'parts.view',
    'workorder.view',
    'team.view',
    'settings.view',
    'calendar.view',
    'analytics.view',
    'todo.view', 'todo.add', 'todo.edit', 'todo.complete'
  ],
  
  Sponsor: [
    // View-only access to most things - View only todo
    'checklist.view',
    'passlog.view',
    'engine.view',
    'supercharger.view',
    'cylinderhead.view',
    'maintenance.view',
    'sfi.view',
    'parts.view',
    'workorder.view',
    'team.view',
    'calendar.view',
    'analytics.view',
    'todo.view'
  ],
  
  Guest: [
    // Minimal access - View only todo
    'checklist.view',
    'passlog.view',
    'calendar.view',
    'todo.view'
  ]
};


// ============ ROLE HIERARCHY ============

export const roleHierarchy: Record<CrewRole, number> = {
  Admin: 100,
  Owner: 90,
  'Crew Chief': 80,
  Driver: 70,
  Tuner: 60,
  Mechanic: 50,
  Crew: 40,
  Sponsor: 20,
  Guest: 10
};

// ============ HELPER FUNCTIONS ============

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: CrewRole, permission: Permission): boolean {
  const permissions = rolePermissions[role] || [];
  return permissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: CrewRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: CrewRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: CrewRole): Permission[] {
  return rolePermissions[role] || [];
}

/**
 * Check if a role can manage another role (based on hierarchy)
 */
export function canManageRole(managerRole: CrewRole, targetRole: CrewRole): boolean {
  return roleHierarchy[managerRole] > roleHierarchy[targetRole];
}

/**
 * Check if a role is admin-level (Admin or Owner)
 */
export function isAdminRole(role: CrewRole): boolean {
  return role === 'Admin' || role === 'Owner';
}

/**
 * Check if a role can edit critical settings
 */
export function canEditCriticalSettings(role: CrewRole): boolean {
  return hasPermission(role, 'settings.admin') || hasPermission(role, 'settings.edit');
}

/**
 * Check if a role can manage team members
 */
export function canManageTeam(role: CrewRole): boolean {
  return hasPermission(role, 'team.manage_roles');
}

/**
 * Get the display color for a role
 */
export function getRoleColor(role: CrewRole): string {
  switch (role) {
    case 'Admin': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Owner': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Crew Chief': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Driver': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'Tuner': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'Mechanic': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Crew': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'Sponsor': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Guest': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

/**
 * Get a description of what a role can do
 */
export function getRoleDescription(role: CrewRole): string {
  switch (role) {
    case 'Admin': return 'Full access to all features and settings. Can manage all team members and roles.';
    case 'Owner': return 'Full access to team operations. Can manage team members and most settings.';
    case 'Crew Chief': return 'Can edit most data, manage maintenance, and reset checklists. Cannot delete critical items.';
    case 'Driver': return 'Can view all data, add pass logs, and check items on checklists.';
    case 'Tuner': return 'Focus on engine and setup data. Can edit performance-related items.';
    case 'Mechanic': return 'Focus on maintenance and parts. Can manage work orders and inventory.';
    case 'Crew': return 'Can view all data and check items on checklists. Cannot edit settings.';
    case 'Sponsor': return 'View-only access to team data and analytics.';
    case 'Guest': return 'Limited view-only access to basic information.';
    default: return 'Unknown role';
  }
}

// ============ PERMISSION CATEGORIES ============

export const permissionCategories = {
  checklists: {
    label: 'Checklists',
    permissions: [
      { id: 'checklist.view', label: 'View checklists' },
      { id: 'checklist.check', label: 'Check/uncheck items' },
      { id: 'checklist.edit', label: 'Edit checklist items' },
      { id: 'checklist.delete', label: 'Delete checklist items' },
      { id: 'checklist.reset', label: 'Reset checklists' }
    ]
  },
  passLogs: {
    label: 'Pass Logs',
    permissions: [
      { id: 'passlog.view', label: 'View pass logs' },
      { id: 'passlog.add', label: 'Add pass logs' },
      { id: 'passlog.edit', label: 'Edit pass logs' },
      { id: 'passlog.delete', label: 'Delete pass logs' }
    ]
  },
  engines: {
    label: 'Main Components',

    permissions: [
      { id: 'engine.view', label: 'View engines' },
      { id: 'engine.add', label: 'Add engines' },
      { id: 'engine.edit', label: 'Edit engines' },
      { id: 'engine.delete', label: 'Delete engines' },
      { id: 'engine.swap', label: 'Perform engine swaps' }
    ]
  },
  superchargers: {
    label: 'Superchargers',
    permissions: [
      { id: 'supercharger.view', label: 'View superchargers' },
      { id: 'supercharger.add', label: 'Add superchargers' },
      { id: 'supercharger.edit', label: 'Edit superchargers' },
      { id: 'supercharger.delete', label: 'Delete superchargers' }
    ]
  },
  cylinderHeads: {
    label: 'Cylinder Heads',
    permissions: [
      { id: 'cylinderhead.view', label: 'View cylinder heads' },
      { id: 'cylinderhead.add', label: 'Add cylinder heads' },
      { id: 'cylinderhead.edit', label: 'Edit cylinder heads' },
      { id: 'cylinderhead.delete', label: 'Delete cylinder heads' }
    ]
  },
  maintenance: {
    label: 'Maintenance',
    permissions: [
      { id: 'maintenance.view', label: 'View maintenance items' },
      { id: 'maintenance.add', label: 'Add maintenance items' },
      { id: 'maintenance.edit', label: 'Edit maintenance items' },
      { id: 'maintenance.delete', label: 'Delete maintenance items' }
    ]
  },
  sfi: {
    label: 'SFI Certifications',
    permissions: [
      { id: 'sfi.view', label: 'View SFI certs' },
      { id: 'sfi.add', label: 'Add SFI certs' },
      { id: 'sfi.edit', label: 'Edit SFI certs' },
      { id: 'sfi.delete', label: 'Delete SFI certs' }
    ]
  },
  parts: {
    label: 'Parts Inventory',
    permissions: [
      { id: 'parts.view', label: 'View parts' },
      { id: 'parts.add', label: 'Add parts' },
      { id: 'parts.edit', label: 'Edit parts' },
      { id: 'parts.delete', label: 'Delete parts' }
    ]
  },
  workOrders: {
    label: 'Work Orders',
    permissions: [
      { id: 'workorder.view', label: 'View work orders' },
      { id: 'workorder.add', label: 'Create work orders' },
      { id: 'workorder.edit', label: 'Edit work orders' },
      { id: 'workorder.delete', label: 'Delete work orders' }
    ]
  },
  team: {
    label: 'Team Management',
    permissions: [
      { id: 'team.view', label: 'View team members' },
      { id: 'team.add', label: 'Add team members' },
      { id: 'team.edit', label: 'Edit team members' },
      { id: 'team.delete', label: 'Remove team members' },
      { id: 'team.manage_roles', label: 'Manage roles & permissions' }
    ]
  },
  settings: {
    label: 'Settings',
    permissions: [
      { id: 'settings.view', label: 'View settings' },
      { id: 'settings.edit', label: 'Edit settings' },
      { id: 'settings.admin', label: 'Admin settings' }
    ]
  },
  calendar: {
    label: 'Race Calendar',
    permissions: [
      { id: 'calendar.view', label: 'View calendar' },
      { id: 'calendar.add', label: 'Add events' },
      { id: 'calendar.edit', label: 'Edit events' },
      { id: 'calendar.delete', label: 'Delete events' }
    ]
  },
  analytics: {
    label: 'Analytics',
    permissions: [
      { id: 'analytics.view', label: 'View analytics' },
      { id: 'analytics.export', label: 'Export data' }
    ]
  },
  todoList: {
    label: 'To Do List',
    permissions: [
      { id: 'todo.view', label: 'View to-do items' },
      { id: 'todo.add', label: 'Add to-do items' },
      { id: 'todo.edit', label: 'Edit to-do items' },
      { id: 'todo.delete', label: 'Delete to-do items' },
      { id: 'todo.complete', label: 'Mark items complete' },
      { id: 'todo.assign', label: 'Assign items to others' },
      { id: 'todo.manage', label: 'Manage all to-do items' }
    ]
  }
};


// List of all available roles
export const allRoles: CrewRole[] = [
  'Admin',
  'Owner',
  'Crew Chief',
  'Driver',
  'Tuner',
  'Mechanic',
  'Crew',
  'Sponsor',
  'Guest'
];
