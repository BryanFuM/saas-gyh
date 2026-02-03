/**
 * React Query hooks for ventas (sales) - Connected to Supabase RPC
 * Reemplaza use-ventas.ts (datos mock)
 * 
 * Usa la RPC `crear_venta` para transacciones atómicas
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables, Views } from '@/lib/database.types';
import { stockKeys } from './use-stock-supabase';
import { clientKeys } from './use-clients-supabase';

// Types
export type Venta = Tables<'ventas'> & {
  items?: VentaItem[];
  client?: { name: string; whatsapp_number?: string } | null;
};

export type VentaItem = Tables<'venta_items'> & {
  product?: { name: string; type: string; quality: string } | null;
};

export interface VentaCreateInput {
  type: 'CAJA' | 'PEDIDO';
  client_id?: number | null;
  guest_client_name?: string | null;
  user_id?: string | null;  // UUID o null si no hay auth válido
  payment_method?: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'CREDITO';
  amortization?: number;
  items: Array<{
    product_id: number;
    quantity_kg: number;
    quantity_javas?: number;
    price_per_kg: number;
  }>;
}

export type VentaUpdateInput = VentaCreateInput & {
  venta_id: number;
};

export interface VentaListParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  client_id?: number;
  type?: 'CAJA' | 'PEDIDO';
  skip?: number;
  limit?: number;
}

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
    queryFn: async () => {
      console.log('🧾 Fetching ventas from Supabase...');
      
      let query = supabase
        .from('ventas')
        .select(`
          *,
          client:clients(name, whatsapp_number),
          items:venta_items(
            *,
            product:products(name, type, quality)
          )
        `)
        .eq('is_cancelled', false)
        .order('created_at', { ascending: false });

      // Apply filters
      if (params?.date) {
        query = query.eq('date', params.date);
      }
      if (params?.start_date) {
        query = query.gte('date', params.start_date);
      }
      if (params?.end_date) {
        query = query.lte('date', params.end_date);
      }
      if (params?.client_id) {
        query = query.eq('client_id', params.client_id);
      }
      if (params?.type) {
        query = query.eq('type', params.type);
      }
      if (params?.limit) {
        query = query.limit(params.limit);
      }
      if (params?.skip) {
        query = query.range(params.skip, params.skip + (params.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching ventas:', error);
        throw new Error(error.message);
      }
      
      console.log(`✅ Loaded ${data.length} ventas`);
      return data as Venta[];
    },
  });
}

/**
 * Hook to fetch a single venta with items
 */
export function useVenta(id: number) {
  return useQuery({
    queryKey: ventaKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          client:clients(name, whatsapp_number),
          items:venta_items(
            *,
            product:products(name, type, quality)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data as Venta;
    },
    enabled: !!id,
  });
}

/**
 * Hook to create a venta using RPC (transaccional atómico)
 * 
 * Esta función:
 * 1. Inserta la venta
 * 2. Inserta los items
 * 3. Descuenta el stock (permite negativos)
 * 4. Actualiza la deuda del cliente (si aplica)
 */
export function useCreateVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: VentaCreateInput) => {
      console.log('💰 Creating venta via RPC...', input);

      // Validar que user_id sea un UUID válido (36 caracteres con guiones)
      const isValidUUID = input.user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.user_id);
      
      if (!isValidUUID) {
        console.error('❌ user_id inválido:', input.user_id);
        throw new Error('Sesión inválida. Por favor, cierra sesión y vuelve a iniciar.');
      }

      const { data, error } = await supabase.rpc('crear_venta', {
        p_type: input.type,
        p_client_id: input.client_id || null,
        p_guest_client_name: input.guest_client_name || null,
        p_user_id: input.user_id,
        p_payment_method: input.payment_method || 'EFECTIVO',
        p_amortization: input.amortization || 0,
        p_items: input.items,
      });

      if (error) {
        console.error('❌ RPC Error:', error);
        throw new Error(error.message);
      }

      // La RPC devuelve JSONB con el resultado
      const result = data as { 
        success: boolean; 
        venta_id?: number; 
        error?: string;
        total_amount?: number;
        new_debt?: number;
      };

      if (!result.success) {
        throw new Error(result.error || 'Error desconocido al crear la venta');
      }

      console.log('✅ Venta created:', result);
      return result;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ventaKeys.all });
      queryClient.invalidateQueries({ queryKey: stockKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.withDebt });
    },
  });
}

/**
 * Hook to update a venta using RPC (transaccional atómico)
 */
export function useUpdateVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: VentaUpdateInput) => {
      console.log('🔄 Updating venta via RPC...', input);

      const isValidUUID = input.user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.user_id);
      
      const { data, error } = await supabase.rpc('editar_venta', {
        p_venta_id: input.venta_id,
        p_type: input.type,
        p_client_id: input.client_id || null,
        p_guest_client_name: input.guest_client_name || null,
        p_user_id: isValidUUID ? input.user_id : null,
        p_payment_method: input.payment_method || 'EFECTIVO',
        p_amortization: input.amortization || 0,
        p_items: input.items,
      });

      if (error) {
        console.error('❌ RPC Error:', error);
        throw new Error(error.message);
      }

      const result = data as { 
        success: boolean; 
        venta_id?: number; 
        error?: string;
        total_amount?: number;
        new_debt?: number;
      };

      if (!result.success) {
        throw new Error(result.error || 'Error desconocido al actualizar la venta');
      }

      console.log('✅ Venta updated:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ventaKeys.all });
      queryClient.invalidateQueries({ queryKey: stockKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.withDebt });
    },
  });
}

/**
 * Hook to cancel a venta (soft delete)
 */
export function useCancelVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('ventas')
        .update({ is_cancelled: true })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ventaKeys.all });
    },
  });
}

/**
 * Hook to mark a venta as printed
 */
export function useMarkVentaPrinted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('ventas')
        .update({ is_printed: true })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ventaKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ventaKeys.detail(id) });
    },
  });
}
