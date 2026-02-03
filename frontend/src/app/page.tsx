'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useDashboardStats } from '@/hooks/use-dashboard-supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Banknote, 
  AlertCircle, 
  Phone, 
  Truck, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  TrendingDown, 
  ClipboardList,
  Lock,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const { user, isHydrated, hydrate } = useAuthStore();
  const { data: stats, isLoading } = useDashboardStats();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  // Comparison Logic (Simple)
  const salesDiff = (stats?.kpis.sales_today || 0) - (stats?.kpis.sales_yesterday || 0);
  const isPositive = salesDiff >= 0;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Hola, {user.username} 👋</h1>
           <p className="text-gray-500">¿Qué requiere tu atención hoy?</p>
        </div>
        <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">
                {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
        </div>
      </div>

      {/* ROW 1: LIVE STATUS KPIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ventas Hoy */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex justify-between">
              Ventas de Hoy
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">S/ {(stats?.kpis.sales_today || 0).toFixed(2)}</div>
            <div className={`text-xs flex items-center mt-1 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
               {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
               {Math.abs(salesDiff).toFixed(2)} vs ayer
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: En Cajas (Efectivo) */}
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex justify-between">
              En Caja (Efectivo)
              <Banknote className="h-4 w-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">S/ {(stats?.kpis.cash_today || 0).toFixed(2)}</div>
            <p className="text-xs text-gray-400 mt-1">Disponible para gastos</p>
          </CardContent>
        </Card>

        {/* KPI 3: Tickets */}
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex justify-between">
              Tickets Hoy
              <ClipboardList className="h-4 w-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats?.kpis.tickets_today || 0}</div>
            <p className="text-xs text-gray-400 mt-1">Operaciones realizadas</p>
          </CardContent>
        </Card>

        {/* KPI 4: Alertas Stock */}
        <Card className={`border-l-4 shadow-sm ${ (stats?.kpis.low_stock_count || 0) > 0 ? 'border-l-red-500 bg-red-50/10' : 'border-l-gray-300' }`}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex justify-between">
              Alertas Stock
              <AlertCircle className={`h-4 w-4 ${ (stats?.kpis.low_stock_count || 0) > 0 ? 'text-red-500' : 'text-gray-400' }`} />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-2xl font-bold ${ (stats?.kpis.low_stock_count || 0) > 0 ? 'text-red-600' : 'text-gray-700' }`}>
                {stats?.kpis.low_stock_count || 0}
            </div>
            <p className="text-xs text-gray-400 mt-1">Productos por agotarse</p>
          </CardContent>
        </Card>
      </div>

      {/* ROW 2: GESTIÓN DE COBRANZAS */}
      <Card className="shadow-sm">
         <CardHeader className="pb-3 border-b bg-gray-50/50">
            <div className="flex items-center justify-between">
                <div>
                   <CardTitle className="text-lg">Deudores Prioritarios</CardTitle>
                   <CardDescription>Clientes con mayor deuda acumulada</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/clientes" className="text-blue-600">Ver todos</Link>
                </Button>
            </div>
         </CardHeader>
         <CardContent className="p-0">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                            <th className="px-6 py-3">Cliente</th>
                            <th className="px-6 py-3">Deuda Total</th>
                            <th className="px-6 py-3">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats?.top_debtors?.length === 0 ? (
                           <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                    ¡Excelente! No hay clientes con deuda pendiente.
                                </td>
                           </tr>
                        ) : (
                           stats?.top_debtors?.map((client) => (
                             <tr key={client.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-3 font-medium text-gray-900">{client.name}</td>
                                <td className="px-6 py-3 text-red-600 font-bold">S/ {Number(client.current_debt).toFixed(2)}</td>
                                <td className="px-6 py-3">
                                   {client.whatsapp_number ? (
                                     <Button size="sm" variant="outline" className="h-8 gap-2 text-green-600 border-green-200 hover:bg-green-50" asChild>
                                        <a 
                                          href={`https://wa.me/51${client.whatsapp_number}?text=Hola ${client.name}, le escribimos de Agroinversiones Beto para recordarle que tiene una deuda pendiente de S/ ${Number(client.current_debt).toFixed(2)}. Agradeceremos su pago.`}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                            <Phone className="h-3 w-3" />
                                            Cobrar
                                        </a>
                                     </Button>
                                   ) : (
                                     <span className="text-gray-400 italic text-xs">Sin teléfono</span>
                                   )}
                                </td>
                             </tr>
                           ))
                        )}
                    </tbody>
                </table>
            </div>
         </CardContent>
      </Card>

      {/* ROW 3: CRITICAL INVENTORY & ACCESOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* COL IZQ: Stock Crítico */}
         <Card className="lg:col-span-1 shadow-sm border-t-4 border-t-red-500">
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Stock Crítico
                </CardTitle>
                <CardDescription>Reponer urgentemente</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-3">
                  {stats?.critical_stock?.length === 0 ? (
                      <div className="text-center py-6 text-green-600 bg-green-50 rounded-lg">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-medium">Inventario Saludable</p>
                      </div>
                  ) : (
                      stats?.critical_stock?.map((item) => (
                          <div key={item.product_id} className="flex justify-between items-center p-2 bg-red-50 rounded border border-red-100">
                             <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]" title={item.full_name}>
                                {item.full_name}
                             </span>
                             <span className="text-sm font-bold text-red-700">
                                {Number(item.stock_javas).toFixed(1)} javas
                             </span>
                          </div>
                      ))
                  )}
                  {stats?.critical_stock && stats.critical_stock.length > 0 && (
                     <Button variant="link" className="w-full text-red-600 h-auto p-0 pt-2" asChild>
                        <Link href="/ingresos">Ir a Ingresos <ArrowRight className="h-3 w-3 ml-1" /></Link>
                     </Button>
                  )}
               </div>
            </CardContent>
         </Card>

         {/* COL DER: Accesos Rápidos */}
         <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 text-lg hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm" asChild>
                <Link href="/ventas">
                   <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                      <ShoppingCart className="h-8 w-8" />
                   </div>
                   Nueva Venta
                </Link>
            </Button>

            <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 text-lg hover:border-orange-500 hover:bg-orange-50 transition-all shadow-sm" asChild>
                <Link href="/ingresos">
                   <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                      <Truck className="h-8 w-8" />
                   </div>
                   Ingreso Mercadería
                </Link>
            </Button>

            <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 text-lg hover:border-purple-500 hover:bg-purple-50 transition-all shadow-sm" asChild>
                <Link href="/productos">
                   <div className="p-3 bg-purple-100 rounded-full text-purple-600">
                      <ClipboardList className="h-8 w-8" />
                   </div>
                   Ver Kárdex
                </Link>
            </Button>

            <Button variant="outline" className="h-32 flex flex-col items-center justify-center gap-3 text-lg hover:border-gray-500 hover:bg-gray-50 transition-all shadow-sm cursor-not-allowed opacity-70">
                {/* Placeholder logic for future implementaion */}
                   <div className="p-3 bg-gray-100 rounded-full text-gray-600">
                      <Lock className="h-8 w-8" />
                   </div>
                   Cierre de Caja
            </Button>
         </div>
      </div>
    </div>
  );
}
