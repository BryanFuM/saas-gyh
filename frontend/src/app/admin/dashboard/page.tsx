'use client';

import { useAuthStore } from '@/store/auth-store';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  Users, 
  AlertTriangle 
} from 'lucide-react';
// import { SalesSummary } from '../components/sales-summary'; // Commented out until migrated

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-500">
        Error al cargar el dashboard: {error.message}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de Administración</h1>
          <p className="text-muted-foreground">Resumen de operaciones del día.</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Ventas Hoy */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              S/ {stats?.dailySales.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Acumulado del día</p>
          </CardContent>
        </Card>

        {/* Card Por Cobrar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Por Cobrar</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              S/ {stats?.totalDebt.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Deuda total de clientes</p>
          </CardContent>
        </Card>

        {/* Card Alertas Stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alertas Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground">Productos con stock bajo</p>
          </CardContent>
        </Card>
      </div>

      {/* 
        Nota: La tabla de resumen gráfico y listado detallado de ventas se han ocultado temporalmente
        porque dependían del backend antiguo. Se pueden reactivar migrándolas a Supabase si es necesario.
      */}
    </div>
  );
}
