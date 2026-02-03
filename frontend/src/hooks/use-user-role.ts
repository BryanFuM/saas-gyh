import { useAuthStore } from '@/store/auth-store';

export function useUserRole() {
  const { user } = useAuthStore();
  
  return {
    role: user?.role,
    isAdmin: user?.role === 'ADMIN',
    isVendedor: user?.role === 'VENDEDOR',
    isInventor: user?.role === 'INVENTOR',
    // Helper to check arbitrary permissions if we had them, 
    // for now we stick to roles.
    canDeleteSales: user?.role === 'ADMIN',
    canViewReports: user?.role === 'ADMIN',
    canManageUsers: user?.role === 'ADMIN',
  };
}
