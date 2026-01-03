/**
 * React Query hooks for ventas (sales).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Venta, VentaCreate, VentaUpdate, VentaListParams } from '@/lib/api';
import { ingresoKeys } from './use-ingresos';

export const ventaKeys = {
  all: ['ventas'] as const,
  lists: () => [...ventaKeys.all, 'list'] as const,
  list: (params?: VentaListParams) => [...ventaKeys.lists(), params] as const,
  detail: (id: number) => [...ventaKeys.all, id] as const,
};

/**
 * Hook to fetch ventas with optional filters
 */
export function useVentas(params?: VentaListParams) {
  return useQuery({
    queryKey: ventaKeys.list(params),
    queryFn: () => api.ventas.list(params),
  });
}

/**
 * Hook to fetch a single venta
 */
export function useVenta(id: number) {
  return useQuery({
    queryKey: ventaKeys.detail(id),
    queryFn: () => api.ventas.get(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a venta
 */
export function useCreateVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VentaCreate) => api.ventas.create(data),
    onSuccess: () => {
      // Invalidate ventas and stock
      queryClient.invalidateQueries({ queryKey: ventaKeys.all });
      queryClient.invalidateQueries({ queryKey: ingresoKeys.stock() });
      queryClient.invalidateQueries({ queryKey: ingresoKeys.stockDetail() });
    },
  });
}

/**
 * Hook to update a venta
 */
export function useUpdateVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: VentaUpdate }) =>
      api.ventas.update(id, data),
    onSuccess: (_: Venta, variables: { id: number; data: VentaUpdate }) => {
      queryClient.invalidateQueries({ queryKey: ventaKeys.all });
      queryClient.invalidateQueries({ queryKey: ventaKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ingresoKeys.stock() });
      queryClient.invalidateQueries({ queryKey: ingresoKeys.stockDetail() });
    },
  });
}

/**
 * Hook to delete a venta
 */
export function useDeleteVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.ventas.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ventaKeys.all });
      queryClient.invalidateQueries({ queryKey: ingresoKeys.stock() });
      queryClient.invalidateQueries({ queryKey: ingresoKeys.stockDetail() });
    },
  });
}

/**
 * Hook to mark a venta as printed
 */
export function useMarkVentaPrinted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.ventas.markPrinted(id),
    onSuccess: (_: void, id: number) => {
      queryClient.invalidateQueries({ queryKey: ventaKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ventaKeys.detail(id) });
    },
  });
}
