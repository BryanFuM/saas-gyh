/**
 * React Query hooks for ingresos (stock entries).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, IngresoLote, IngresoLoteCreate, StockInfo, StockDetail } from '@/lib/api';

export const ingresoKeys = {
  all: ['ingresos'] as const,
  lists: () => [...ingresoKeys.all, 'list'] as const,
  list: (skip: number, limit: number) => [...ingresoKeys.lists(), { skip, limit }] as const,
  detail: (id: number) => [...ingresoKeys.all, id] as const,
  stock: () => [...ingresoKeys.all, 'stock'] as const,
  stockDetail: () => [...ingresoKeys.all, 'stockDetail'] as const,
};

/**
 * Hook to fetch ingreso lotes with pagination
 */
export function useIngresos(skip = 0, limit = 50) {
  return useQuery({
    queryKey: ingresoKeys.list(skip, limit),
    queryFn: () => api.ingresos.list(skip, limit),
  });
}

/**
 * Hook to fetch a single ingreso lote
 */
export function useIngreso(id: number) {
  return useQuery({
    queryKey: ingresoKeys.detail(id),
    queryFn: () => api.ingresos.get(id),
    enabled: !!id,
  });
}

/**
 * Hook to fetch available stock by product
 */
export function useStock() {
  return useQuery({
    queryKey: ingresoKeys.stock(),
    queryFn: () => api.ingresos.stock(),
  });
}

/**
 * Hook to fetch detailed stock information
 */
export function useStockDetail() {
  return useQuery({
    queryKey: ingresoKeys.stockDetail(),
    queryFn: () => api.ingresos.stockDetail(),
  });
}

/**
 * Hook to create an ingreso lote
 */
export function useCreateIngreso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IngresoLoteCreate) => api.ingresos.create(data),
    onSuccess: () => {
      // Invalidate all ingreso-related queries
      queryClient.invalidateQueries({ queryKey: ingresoKeys.all });
    },
  });
}

/**
 * Hook to delete an ingreso lote
 */
export function useDeleteIngreso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.ingresos.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ingresoKeys.all });
    },
  });
}
