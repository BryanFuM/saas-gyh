/**
 * React Query hooks for product qualities.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ProductQuality } from '@/lib/api';

export const productQualityKeys = {
  all: ['productQualities'] as const,
  usageCount: (id: number) => [...productQualityKeys.all, 'usage', id] as const,
};

/**
 * Hook to fetch all product qualities
 */
export function useProductQualities() {
  return useQuery({
    queryKey: productQualityKeys.all,
    queryFn: () => api.productQualities.list(),
  });
}

/**
 * Hook to create a product quality
 */
export function useCreateProductQuality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.productQualities.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQualityKeys.all });
    },
  });
}

/**
 * Hook to delete a product quality
 */
export function useDeleteProductQuality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.productQualities.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQualityKeys.all });
    },
  });
}

/**
 * Hook to get usage count for a product quality
 */
export function useProductQualityUsageCount(id: number) {
  return useQuery({
    queryKey: productQualityKeys.usageCount(id),
    queryFn: () => api.productQualities.getUsageCount(id),
    enabled: !!id,
  });
}
