import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { startOfDay } from 'date-fns';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Get start of day in local time, converted to ISO
      const today = startOfDay(new Date()).toISOString();

      // 1. Ventas del Día
      const salesPromise = supabase
        .from('ventas')
        .select('total_amount')
        .gte('date', today)
        .eq('is_cancelled', false);

      // 2. Cuentas por Cobrar (Deuda Total)
      const debtPromise = supabase
        .from('clients')
        .select('current_debt')
        .gt('current_debt', 0);

      // 3. Alertas de Stock (usando vista v_stock_disponible)
      const stockPromise = supabase
        .from('v_stock_disponible')
        .select('*', { count: 'exact', head: true })
        .in('estado_stock', ['BAJO', 'NEGATIVO']);

      const [salesRes, debtRes, stockRes] = await Promise.all([
        salesPromise,
        debtPromise,
        stockPromise
      ]);

      if (salesRes.error) throw salesRes.error;
      if (debtRes.error) throw debtRes.error;
      if (stockRes.error) throw stockRes.error;

      const dailySales = salesRes.data?.reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;
      const totalDebt = debtRes.data?.reduce((sum, item) => sum + Number(item.current_debt), 0) || 0;
      const lowStockCount = stockRes.count || 0;

      return {
        dailySales,
        totalDebt,
        lowStockCount
      };
    }
  });
}
