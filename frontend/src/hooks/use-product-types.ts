/**
 * React Query hooks for product types.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ProductType } from '@/lib/api';

export const productTypeKeys = {
  all: ['productTypes'] as const,
  usageCount: (id: number) => [...productTypeKeys.all, 'usage', id] as const,
};

/**
 * Hook to fetch all product types
 */
export function useProductTypes() {
  return useQuery({
    queryKey: productTypeKeys.all,
    queryFn: () => api.productTypes.list(),
  });
}

/**
 * Hook to create a product type
 */
export function useCreateProductType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.productTypes.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productTypeKeys.all });
    },
  });
}

/**
 * Hook to delete a product type
 */
export function useDeleteProductType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.productTypes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productTypeKeys.all });
    },
  });
}

/**
 * Hook to get usage count for a product type
 */
export function useProductTypeUsageCount(id: number) {
  return useQuery({
    queryKey: productTypeKeys.usageCount(id),
    queryFn: () => api.productTypes.getUsageCount(id),
    enabled: !!id,
  });
}
