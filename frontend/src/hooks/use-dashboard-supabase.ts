import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface DashboardStats {
  kpis: {
    sales_today: number;
    sales_yesterday: number;
    cash_today: number;
    tickets_today: number;
    low_stock_count: number;
  };
  top_debtors: Array<{
    id: number;
    name: string;
    current_debt: number;
    whatsapp_number?: string;
    updated_at: string;
  }>;
  critical_stock: Array<{
    product_id: number;
    full_name: string;
    stock_javas: number;
    estado_stock: string;
  }>;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      
      if (error) {
        console.error('Error fetching dashboard stats:', error);
        throw new Error(error.message);
      }
      
      return data as DashboardStats;
    },
    refetchInterval: 30000, // Refresh every 30s for "Live Status" feel
  });
}

export interface DailyVolume {
  name: string;
  total_kg: number;
}

export function useDailyVolume() {
  return useQuery({
    queryKey: ['daily_volume'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_daily_volume_summary');
      
      if (error) {
        console.error('Error fetching daily volume:', error);
        throw new Error(error.message);
      }
      
      return data as DailyVolume[];
    },
    refetchInterval: 30000,
  });
}
