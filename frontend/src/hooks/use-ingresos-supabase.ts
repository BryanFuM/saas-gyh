/**
 * React Query hooks for ingresos (stock entries) - Connected to Supabase
 * Reemplaza use-ingresos.ts (API backend)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { stockKeys } from './use-stock-supabase';

// Types - Alineados con esquema Supabase real
export interface IngresoLote {
  id: number;
  truck_plate: string;
  truck_color?: string;
  date: string;
  total_javas: number;
  total_kg: number;
  total_cost: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  items?: IngresoItem[];
}

export interface IngresoItem {
  id: number;
  ingreso_lote_id: number;
  supplier_name: string;
  product_id: number;
  quantity_javas: number;
  conversion_factor: number;
  total_kg: number;
  cost_per_java: number;
  total_cost: number;
  created_at: string;
  product_name?: string;
  product?: {
    name: string;
    type: string;
    quality: string;
  };
}

export interface IngresoItemCreate {
  supplier_name: string;
  product_id: number;
  total_kg: number;
  conversion_factor: number;
  cost_price_input: number;
  cost_price_mode: 'KG' | 'JAVA';
}

export interface IngresoLoteCreate {
  truck_plate: string;
  truck_color?: string;
  notes?: string;
  items: IngresoItemCreate[];
}

export const ingresoKeys = {
  all: ['ingresos'] as const,
  lists: () => [...ingresoKeys.all, 'list'] as const,
  list: (skip?: number, limit?: number) => [...ingresoKeys.lists(), { skip, limit }] as const,
  detail: (id: number) => [...ingresoKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch ingreso lotes with pagination
 */
export function useIngresos(skip = 0, limit = 50) {
  return useQuery<IngresoLote[]>({
    queryKey: ingresoKeys.list(skip, limit),
    queryFn: async (): Promise<IngresoLote[]> => {
      console.log('📦 Fetching ingresos from Supabase...');
      
      const { data, error } = await supabase
        .from('ingreso_lotes')
        .select(`
          *,
          items:ingreso_items(
            *,
            product:products(name, type, quality)
          )
        `)
        .order('date', { ascending: false })
        .range(skip, skip + limit - 1);

      if (error) {
        console.error('❌ Error fetching ingresos:', error);
        throw new Error(`Error al cargar ingresos: ${error.message}`);
      }

      // Transformar datos para agregar campos calculados
      const transformedData = (data || []).map(lote => {
        const items = (lote.items || []).map((item: IngresoItem) => ({
          ...item,
          product_name: item.product?.name || `Producto #${item.product_id}`
        }));
        
        // Los totales vienen de la DB, pero recalculamos por si acaso
        const calc_kg = items.reduce((sum: number, item: IngresoItem) => sum + Number(item.total_kg || 0), 0);
        const calc_javas = items.reduce((sum: number, item: IngresoItem) => sum + Number(item.quantity_javas || 0), 0);
        const calc_cost = items.reduce((sum: number, item: IngresoItem) => sum + Number(item.total_cost || 0), 0);
        
        return {
          ...lote,
          items,
          // Usar valores de DB o calculados
          total_kg: lote.total_kg || calc_kg,
          total_javas: lote.total_javas || calc_javas,
          total_cost: lote.total_cost || calc_cost
        };
      });

      console.log(`✅ Loaded ${transformedData.length} ingresos`);
      return transformedData as IngresoLote[];
    },
  });
}

/**
 * Hook to fetch a single ingreso lote
 */
export function useIngreso(id: number) {
  return useQuery<IngresoLote>({
    queryKey: ingresoKeys.detail(id),
    queryFn: async (): Promise<IngresoLote> => {
      const { data, error } = await supabase
        .from('ingreso_lotes')
        .select(`
          *,
          items:ingreso_items(
            *,
            product:products(name, type, quality)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      
      // Transformar para agregar campos calculados
      const items = (data.items || []).map((item: IngresoItem) => ({
        ...item,
        product_name: item.product?.name || `Producto #${item.product_id}`
      }));
      
      const calc_kg = items.reduce((sum: number, item: IngresoItem) => sum + Number(item.total_kg || 0), 0);
      const calc_javas = items.reduce((sum: number, item: IngresoItem) => sum + Number(item.quantity_javas || 0), 0);
      const calc_cost = items.reduce((sum: number, item: IngresoItem) => sum + Number(item.total_cost || 0), 0);
      
      return {
        ...data,
        items,
        total_kg: data.total_kg || calc_kg,
        total_javas: data.total_javas || calc_javas,
        total_cost: data.total_cost || calc_cost
      } as IngresoLote;
    },
    enabled: !!id,
  });
}

/**
 * Hook to create an ingreso lote with items
 * Inserta en ingreso_lotes e ingreso_items
 */
export function useCreateIngreso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: IngresoLoteCreate) => {
      console.log('📥 Creating ingreso via Supabase...', input);

      // Calcular totales para el lote
      let lote_total_kg = 0;
      let lote_total_javas = 0;
      let lote_total_cost = 0;

      const itemsToInsert = input.items.map(item => {
        const costPerJava = item.cost_price_mode === 'JAVA' 
          ? item.cost_price_input 
          : item.cost_price_input * item.conversion_factor;
        const quantityJavas = item.total_kg / item.conversion_factor;
        const totalCost = costPerJava * quantityJavas;
        
        lote_total_kg += item.total_kg;
        lote_total_javas += quantityJavas;
        lote_total_cost += totalCost;

        return {
          supplier_name: item.supplier_name,
          product_id: item.product_id,
          total_kg: item.total_kg,
          conversion_factor: item.conversion_factor,
          quantity_javas: quantityJavas,
          cost_per_java: costPerJava,
          total_cost: totalCost,
        };
      });

      // 1. Crear el lote con totales
      const { data: lote, error: loteError } = await supabase
        .from('ingreso_lotes')
        .insert({
          truck_plate: input.truck_plate || 'SIN-PLACA',
          truck_color: input.truck_color || null,
          notes: input.notes || null,
          total_kg: lote_total_kg,
          total_javas: lote_total_javas,
          total_cost: lote_total_cost,
        })
        .select()
        .single();

      if (loteError) {
        console.error('❌ Error creating ingreso_lote:', loteError);
        throw new Error(`Error al crear lote: ${loteError.message}`);
      }

      console.log('✅ Lote created:', lote.id);

      // 2. Agregar ingreso_lote_id a cada item e insertar
      const itemsWithLoteId = itemsToInsert.map(item => ({
        ...item,
        ingreso_lote_id: lote.id,
      }));

      const { error: itemsError } = await supabase
        .from('ingreso_items')
        .insert(itemsWithLoteId);

      if (itemsError) {
        console.error('❌ Error creating ingreso_items:', itemsError);
        // Intentar eliminar el lote si fallan los items
        await supabase.from('ingreso_lotes').delete().eq('id', lote.id);
        throw new Error(`Error al crear items: ${itemsError.message}`);
      }

      console.log('✅ Items created:', itemsToInsert.length);
      return { success: true, ingreso_id: lote.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ingresoKeys.all });
      queryClient.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}

/**
 * Hook to delete an ingreso lote
 */
export function useDeleteIngreso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      // Primero eliminar items
      await supabase
        .from('ingreso_items')
        .delete()
        .eq('ingreso_lote_id', id);

      // Luego eliminar lote
      const { error } = await supabase
        .from('ingreso_lotes')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ingresoKeys.all });
      queryClient.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}
