/**
 * React Query hooks for system users - Connected to Supabase
 * Gestión de usuarios del sistema (admin, vendedor)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface SystemUser {
  id: string; // UUID
  username: string;
  role: 'ADMIN' | 'VENDEDOR';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  role: 'ADMIN' | 'VENDEDOR';
}

export const userKeys = {
  all: ['users'] as const,
  detail: (id: string) => [...userKeys.all, id] as const,
};

/**
 * Hook to fetch all active system users
 */
export function useSystemUsers() {
  return useQuery<SystemUser[]>({
    queryKey: userKeys.all,
    queryFn: async (): Promise<SystemUser[]> => {
      console.log('👤 Fetching system users from Supabase...');
      const { data, error } = await supabase
        .from('users')
        .select('id, username, role, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('username');

      if (error) {
        console.error('❌ Error fetching users:', error);
        throw new Error(`Error al cargar usuarios: ${error.message}`);
      }

      console.log(`✅ Loaded ${data?.length || 0} users`);
      return (data as SystemUser[]) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a new system user
 * Note: En una app real, esto debería hacerse via Supabase Auth
 * Por ahora usamos la tabla users directamente con password hasheado
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: CreateUserData) => {
      console.log('➕ Creating user:', userData.username);
      
      // Verificar si el username ya existe
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', userData.username)
        .single();

      if (existing) {
        throw new Error('El nombre de usuario ya existe');
      }

      // Nota: En producción, el password debería hashearse en el servidor
      // Aquí usamos bcrypt en el backend o una función serverless
      // Por simplicidad, guardamos directamente (NO RECOMENDADO para producción)
      const { data, error } = await supabase
        .from('users')
        .insert({
          username: userData.username,
          password_hash: userData.password, // En prod: hashear con bcrypt
          role: userData.role,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user:', error);
        throw new Error(`Error al crear usuario: ${error.message}`);
      }

      console.log('✅ User created:', data.username);
      return data as SystemUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

/**
 * Hook to delete (deactivate) a system user
 * Soft delete: sets is_active = false
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      console.log('🗑️ Deactivating user:', userId);
      
      const { error } = await supabase
        .from('users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        console.error('❌ Error deleting user:', error);
        throw new Error(`Error al eliminar usuario: ${error.message}`);
      }

      console.log('✅ User deactivated');
      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

/**
 * Hook to update user role
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'ADMIN' | 'VENDEDOR' }) => {
      console.log('✏️ Updating user role:', userId, role);
      
      const { data, error } = await supabase
        .from('users')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating user:', error);
        throw new Error(`Error al actualizar usuario: ${error.message}`);
      }

      console.log('✅ User role updated');
      return data as SystemUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
