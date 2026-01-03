/**
 * React Query hooks for products.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Product, ProductCreate } from '@/lib/api';

export const productKeys = {
  all: ['products'] as const,
  detail: (id: number) => [...productKeys.all, id] as const,
};

/**
 * Hook to fetch all products
 */
export function useProducts() {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: () => api.products.list(),
  });
}

/**
 * Hook to fetch a single product
 */
export function useProduct(id: number) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => api.products.get(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a product
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProductCreate) => api.products.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

/**
 * Hook to update a product
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProductCreate> }) =>
      api.products.update(id, data),
    onSuccess: (_: Product, variables: { id: number; data: Partial<ProductCreate> }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook to delete a product
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.products.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
