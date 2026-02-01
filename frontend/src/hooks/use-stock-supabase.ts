/**
 * React Query hooks for stock/inventory - Connected to Supabase
 * Usa la vista v_stock_disponible para datos en tiempo real
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Tipo explícito para stock (compatible con la vista v_stock_disponible)
export interface StockItem {
  product_id: number;
  name: string;
  type: string;
  quality: string;
  conversion_factor: number;
  full_name: string;
  stock_javas: number;
  stock_kg: number;
  costo_promedio_java: number;
  estado_stock: 'NORMAL' | 'BAJO' | 'NEGATIVO';
}

export const stockKeys = {
  all: ['stock'] as const,
  available: ['stock', 'available'] as const,
  byProduct: (productId: number) => [...stockKeys.all, 'product', productId] as const,
};

/**
 * Hook to fetch available stock from Supabase view
 * Returns stock with status (NORMAL, BAJO, NEGATIVO)
 * ❌ SIN FALLBACK - Si falla Supabase, muestra error (no datos falsos)
 */
export function useStock() {
  return useQuery<StockItem[]>({
    queryKey: stockKeys.available,
    queryFn: async (): Promise<StockItem[]> => {
      console.log('📊 Fetching stock from Supabase...');
      
      // Intentar obtener de la vista v_stock_disponible
      const { data, error } = await supabase
        .from('v_stock_disponible')
        .select('*')
        .order('type')
        .order('name');

      if (error) {
        console.error('❌ Error fetching stock:', error);
        // ⚠️ NO FALLBACK - Lanzar error para que React Query lo maneje
        throw new Error(`Error al cargar stock: ${error.message}`);
      }
      
      console.log(`✅ Loaded stock for ${data?.length || 0} products`);
      return (data || []) as StockItem[];
    },
    // Refetch every 30 seconds for real-time updates
    refetchInterval: 30000,
  });
}

/**
 * Hook to get stock for a specific product
 */
export function useProductStock(productId: number) {
  return useQuery<StockItem | null>({
    queryKey: stockKeys.byProduct(productId),
    queryFn: async (): Promise<StockItem | null> => {
      const { data, error } = await supabase
        .from('v_stock_disponible')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (error) {
        // Si no hay stock, devolver valores por defecto
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(error.message);
      }
      return data as StockItem;
    },
    enabled: !!productId,
  });
}

/**
 * Create stock map for product selectors
 * Maps product_id -> stock_javas
 */
export function useStockMap() {
  const { data: stock } = useStock();
  
  const stockMap: Record<number, number> = {};
  if (stock) {
    stock.forEach((item) => {
      stockMap[item.product_id] = item.stock_javas;
    });
  }
  
  return stockMap;
}
