import { UserRole } from '@/types';

export interface Permission {
  // User management
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canActivateUsers: boolean;
  canDeactivateUsers: boolean;
  
  // Document management
  canViewDocuments: boolean;
  canUploadDocuments: boolean;
  canDeleteDocuments: boolean;
  

  
  // API Keys management
  canViewApiKeys: boolean;
  canCreateApiKeys: boolean;
  canDeleteApiKeys: boolean;
  canDeactivateApiKeys: boolean;
  
  // Security events
  canViewSecurityEvents: boolean;
  canResolveSecurityEvents: boolean;
  
  // Analytics
  canViewAnalytics: boolean;
  canViewDashboard: boolean;
  
  // Settings
  canViewSettings: boolean;
  canEditSettings: boolean;
  
  // System administration
  canViewSystemHealth: boolean;
  canManageSystem: boolean;
  system_config: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  [UserRole.SUPER_ADMIN]: {
    // Super admin can do everything
    canViewUsers: true,
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canActivateUsers: true,
    canDeactivateUsers: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canDeleteDocuments: true,
    canViewApiKeys: true,
    canCreateApiKeys: true,
    canDeleteApiKeys: true,
    canDeactivateApiKeys: true,
    canViewSecurityEvents: true,
    canResolveSecurityEvents: true,
    canViewAnalytics: true,
    canViewDashboard: true,
    canViewSettings: true,
    canEditSettings: true,
    canViewSystemHealth: true,
    canManageSystem: true,
    system_config: true,
  },
  
  [UserRole.ADMIN]: {
    // Admin can do most things except some system-level operations
    canViewUsers: true,
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canActivateUsers: true,
    canDeactivateUsers: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canDeleteDocuments: true,
    canViewApiKeys: true,
    canCreateApiKeys: true,
    canDeleteApiKeys: true,
    canDeactivateApiKeys: true,
    canViewSecurityEvents: true,
    canResolveSecurityEvents: true,
    canViewAnalytics: true,
    canViewDashboard: true,
    canViewSettings: true,
    canEditSettings: true,
    canViewSystemHealth: true,
    canManageSystem: true,
    system_config: true,
  },
  
  [UserRole.DEVELOPER]: {
    // Developer can view and manage documents, API keys, but cannot manage users
    canViewUsers: true,
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canActivateUsers: false,
    canDeactivateUsers: false,
    canViewDocuments: true,
    canUploadDocuments: false, // Cannot upload documents
    canDeleteDocuments: false,
    canViewApiKeys: true,
    canCreateApiKeys: true,
    canDeleteApiKeys: true,
    canDeactivateApiKeys: true,
    canViewSecurityEvents: true,
    canResolveSecurityEvents: false,
    canViewAnalytics: true,
    canViewDashboard: true,
    canViewSettings: true,
    canEditSettings: false,
    canViewSystemHealth: true,
    canManageSystem: false,
    system_config: false,
  },
  
  [UserRole.ANALYST]: {
    // Analyst can only view data for analysis - no modifications
    canViewUsers: true,
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canActivateUsers: false,
    canDeactivateUsers: false,
    canViewDocuments: true,
    canUploadDocuments: false,
    canDeleteDocuments: false,
    canViewApiKeys: true,
    canCreateApiKeys: false,
    canDeleteApiKeys: false,
    canDeactivateApiKeys: false,
    canViewSecurityEvents: true,
    canResolveSecurityEvents: false,
    canViewAnalytics: true,
    canViewDashboard: true,
    canViewSettings: true,
    canEditSettings: false,
    canViewSystemHealth: true,
    canManageSystem: false,
    system_config: false,
  },
  
  [UserRole.USER]: {
    // Regular users should not access admin interface
    canViewUsers: false,
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canActivateUsers: false,
    canDeactivateUsers: false,
    canViewDocuments: false,
    canUploadDocuments: false,
    canDeleteDocuments: false,
    canViewApiKeys: false,
    canCreateApiKeys: false,
    canDeleteApiKeys: false,
    canDeactivateApiKeys: false,
    canViewSecurityEvents: false,
    canResolveSecurityEvents: false,
    canViewAnalytics: false,
    canViewDashboard: false,
    canViewSettings: false,
    canEditSettings: false,
    canViewSystemHealth: false,
    canManageSystem: false,
    system_config: false,
  },
  
  [UserRole.READONLY]: {
    // Read-only users can only view basic information
    canViewUsers: false,
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canActivateUsers: false,
    canDeactivateUsers: false,
    canViewDocuments: true,
    canUploadDocuments: false,
    canDeleteDocuments: false,
    canViewApiKeys: false,
    canCreateApiKeys: false,
    canDeleteApiKeys: false,
    canDeactivateApiKeys: false,
    canViewSecurityEvents: false,
    canResolveSecurityEvents: false,
    canViewAnalytics: false,
    canViewDashboard: false,
    canViewSettings: false,
    canEditSettings: false,
    canViewSystemHealth: false,
    canManageSystem: false,
    system_config: false,
  },
};

export const getPermissions = (userRole: UserRole): Permission => {
  return ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS[UserRole.USER];
};

export const hasPermission = (userRole: UserRole, permission: keyof Permission): boolean => {
  const permissions = getPermissions(userRole);
  return permissions[permission];
};

// Helper functions for common permission checks
export const canModifyUsers = (userRole: UserRole): boolean => {
  return hasPermission(userRole, 'canCreateUsers') || 
         hasPermission(userRole, 'canEditUsers') || 
         hasPermission(userRole, 'canDeleteUsers');
};

export const canModifyDocuments = (userRole: UserRole): boolean => {
  return hasPermission(userRole, 'canUploadDocuments') || 
         hasPermission(userRole, 'canDeleteDocuments');
};

export const canModifyApiKeys = (userRole: UserRole): boolean => {
  return hasPermission(userRole, 'canCreateApiKeys') || 
         hasPermission(userRole, 'canDeleteApiKeys');
};

export const isViewOnlyRole = (userRole: UserRole): boolean => {
  return userRole === UserRole.ANALYST || userRole === UserRole.READONLY;
};

export const isAdminRole = (userRole: UserRole): boolean => {
  return userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
}; 