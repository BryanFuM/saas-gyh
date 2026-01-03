/**
 * React Query hooks for clients.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Client, ClientCreate } from '@/lib/api';

export const clientKeys = {
  all: ['clients'] as const,
  detail: (id: number) => [...clientKeys.all, id] as const,
};

/**
 * Hook to fetch all clients
 */
export function useClients() {
  return useQuery({
    queryKey: clientKeys.all,
    queryFn: () => api.clients.list(),
  });
}

/**
 * Hook to fetch a single client
 */
export function useClient(id: number) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => api.clients.get(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a client
 */
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClientCreate) => api.clients.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/**
 * Hook to update a client
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ClientCreate> }) =>
      api.clients.update(id, data),
    onSuccess: (_: Client, variables: { id: number; data: Partial<ClientCreate> }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
    },
  });
}
