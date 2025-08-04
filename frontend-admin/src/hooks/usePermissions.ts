import { useMemo } from 'react';
import { useAppSelector } from '@/store';
import { getPermissions, hasPermission, isViewOnlyRole, isAdminRole, canModifyUsers, canModifyDocuments, canModifyApiKeys } from '@/utils/permissions';
import { UserRole } from '@/types';
import type { Permission } from '@/utils/permissions';

export const usePermissions = () => {
  const { user } = useAppSelector((state) => state.auth);
  
  // Provide a default role when user is null to prevent errors
  const userRole = user?.role || UserRole.USER;
  
  const permissions = useMemo(() => getPermissions(userRole), [userRole]);
  
  const checkPermission = (permission: keyof Permission): boolean => {
    return hasPermission(userRole, permission);
  };
  
  const roleChecks = useMemo(() => ({
    isViewOnly: isViewOnlyRole(userRole),
    isAdmin: isAdminRole(userRole),
    canModifyUsers: canModifyUsers(userRole),
    canModifyDocuments: canModifyDocuments(userRole),
    canModifyApiKeys: canModifyApiKeys(userRole),
  }), [userRole]);
  
  return {
    permissions,
    checkPermission,
    userRole,
    ...roleChecks,
  };
};

export default usePermissions; 