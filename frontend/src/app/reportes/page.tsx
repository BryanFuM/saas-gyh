'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, DollarSign, Package, TrendingUp, Users, ShoppingCart, Truck } from 'lucide-react';

// ✅ SUPABASE HOOKS
import { useVentas } from '@/hooks/use-ventas-supabase';
import { useIngresos } from '@/hooks/use-ingresos-supabase';
import { useClients } from '@/hooks/use-clients-supabase';
import { useStock } from '@/hooks/use-stock-supabase';
import { useAuthStore } from '@/store/auth-store';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts } from '@/hooks/use-products-supabase';
import { useState, useMemo } from 'react';
import { ExportExcelButton } from '@/components/export-excel-button';

export default function ReportesPage() {
  const { user } = useAuthStore();
  
  // ✅ React Query hooks conectados a Supabase
  const { data: ventas = [], isLoading: loadingVentas } = useVentas();
  const { data: ingresos = [], isLoading: loadingIngresos } = useIngresos();
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: stock = [], isLoading: loadingStock } = useStock();
  const { data: products = [] } = useProducts();
  
  const isLoading = loadingVentas || loadingIngresos || loadingClients || loadingStock;

  // 🔍 Filtros
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [selectedSaleType, setSelectedSaleType] = useState<string>('ALL');

  // 🔄 Lógica de Filtrado Centralizada
  const filteredData = useMemo(() => {
    if (isLoading) return { ventasList: [], ingresosList: [], ventasAmount: 0, ventasCount: 0, ingresosAmount: 0, ingresosCount: 0 };

    // 1. Filter Ranges
    const from = dateRange?.from ? startOfDay(dateRange.from) : null;
    const to = dateRange?.to ? endOfDay(dateRange.to) : null;

    // Helper: Check date
    const isInDateRange = (dateStr: string) => {
        if (!from || !to) return true;
        const date = parseISO(dateStr);
        return isWithinInterval(date, { start: from, end: to });
    };

    // 2. Filter Ventas & Calculate Total Sales
    // Strategy: If Product Selected -> Sum Items. If Not -> Sum Sale Totals.
    let filteredVentasValue = 0;
    let filteredVentasCount = 0;
    let activeVentas: any[] = []; // Explicitly typed as any[] or Venta[] if available


    // Filter Ventas Base (Date & Type)
    const ventasBase = ventas.filter(v => 
        isInDateRange(v.created_at) && 
        (selectedSaleType === 'ALL' || v.type === selectedSaleType)
    );

    if (selectedProductId !== 'all') {
        // Product Mode: Sum only specific items match
        const pId = parseInt(selectedProductId);
        ventasBase.forEach(venta => {
            const matchingItems = venta.items?.filter((i: any) => i.product_id === pId) || [];
            if (matchingItems.length > 0) {
                const subtotal = matchingItems.reduce((acc: number, i: any) => acc + Number(i.subtotal), 0);
                filteredVentasValue += subtotal;
                filteredVentasCount++; // Count sales containing product
                activeVentas.push(venta);
            }
        });
    } else {
        // General Mode: Sum full sales
        filteredVentasValue = ventasBase.reduce((acc, v) => acc + Number(v.total_amount), 0);
        filteredVentasCount = ventasBase.length;
        activeVentas = ventasBase;
    }

    // 3. Filter Ingresos (Compras)
    let filteredIngresosValue = 0;
    let filteredIngresosCount = 0;

    const ingresosBase = ingresos.filter(i => isInDateRange(i.created_at));

    if (selectedProductId !== 'all') {
         const pId = parseInt(selectedProductId);
         ingresosBase.forEach(ingreso => {
             const matchingItems = ingreso.items?.filter((i: any) => i.product_id === pId) || [];
             if (matchingItems.length > 0) {
                 const subtotal = matchingItems.reduce((acc: number, i: any) => acc + Number(i.total_cost), 0);
                 filteredIngresosValue += subtotal;
                 filteredIngresosCount++;
             }
         });
    } else {
        filteredIngresosValue = ingresosBase.reduce((acc, i) => acc + Number(i.total_cost || 0), 0);
        filteredIngresosCount = ingresosBase.length;
    }

    return {
        ventasAmount: filteredVentasValue,
        ventasCount: filteredVentasCount,
        ventasList: activeVentas,
        ingresosAmount: filteredIngresosValue,
        ingresosCount: filteredIngresosCount,
    };

  }, [ventas, ingresos, dateRange, selectedProductId, selectedSaleType, isLoading]);


  // Calculations derived fram Filters
  const { ventasAmount, ventasCount, ingresosAmount, ingresosCount, ventasList } = filteredData;
  
  // Ganancia Neta = Ventas - Costo de lo vendido (simplificado)
  const gananciaNeta = ventasAmount - ingresosAmount;

  // Breakdown for Graphs/Lists (Simplified for now to use Filtered List)
  const ventasCaja = ventasList.filter(v => v.type === 'CAJA');
  const ventasPedido = ventasList.filter(v => v.type === 'PEDIDO');
  
  // NOTE: If product filter is active, these sub-charts should technically also filter by item, 
  // but for simplicity in "Recent Sales" list, we show the whole sale if it matches.
  
  const totalDeudaPendiente = clients.reduce((acc, c) => acc + Number(c.current_debt || 0), 0);
  // Stock is Snapshot, not date range dependent usually, unless historical. We show current.
  const totalStockJavas = stock.reduce((acc, s) => acc + Number(s.stock_javas || 0), 0);
  

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Acceso Restringido</p>
            <p className="text-gray-400 text-sm">Solo los administradores pueden ver los reportes</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div>
            <h1 className="text-2xl md:text-3xl font-bold">Reportes</h1>
            <p className="text-sm md:text-base text-gray-500">Consolidado de operaciones del sistema</p>
            </div>
        </div>

        {/* 🔍 BARRA DE FILTROS */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
             <ExportExcelButton 
                salesData={ventasList}
                inventoryData={stock}
                clientsData={clients}
                dateRange={dateRange}
             />

             <DateRangePicker 
                dateRange={dateRange}  
                onDateRangeChange={setDateRange}
                className="w-full sm:w-[260px]"
             />
             
             <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Todos los productos" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los Productos</SelectItem>
                    {products.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} - {p.type} ({p.quality})
                        </SelectItem>
                    ))}
                </SelectContent>
             </Select>

             <Select value={selectedSaleType} onValueChange={setSelectedSaleType}>
                <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Tipo Venta" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Todo Tipo</SelectItem>
                    <SelectItem value="CAJA">Caja (Contado)</SelectItem>
                    <SelectItem value="PEDIDO">Pedidos (Crédito)</SelectItem>
                </SelectContent>
             </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* KPIs Principales */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Total Ventas</CardTitle>
                <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg md:text-2xl font-bold text-green-600">S/. {ventasAmount.toFixed(2)}</div>
                <p className="text-xs text-gray-500 mt-1">{ventasCount} transacciones filtradas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Costo Compras</CardTitle>
                <Truck className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg md:text-2xl font-bold text-orange-600">S/. {ingresosAmount.toFixed(2)}</div>
                <p className="text-xs text-gray-500 mt-1">{ingresosCount} ingresos filtrados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Ganancia (Margen)</CardTitle>
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-lg md:text-2xl font-bold ${gananciaNeta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  S/. {gananciaNeta.toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Ventas - Costos (Periodo)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Deuda Total</CardTitle>
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg md:text-2xl font-bold text-red-600">S/. {totalDeudaPendiente.toFixed(2)}</div>
                <p className="text-xs text-gray-500 mt-1">Por cobrar</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs de Reportes Detallados */}
          <Tabs defaultValue="ventas" className="space-y-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="ventas" className="text-xs md:text-sm">Ventas</TabsTrigger>
              <TabsTrigger value="ingresos" className="text-xs md:text-sm">Stock</TabsTrigger>
              <TabsTrigger value="deudas" className="text-xs md:text-sm">Deudas</TabsTrigger>
            </TabsList>

            <TabsContent value="ventas" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Ventas Caja */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      Ventas Caja
                    </CardTitle>
                    <CardDescription>
                         {selectedProductId !== 'all' ? 'Filtrado por producto' : 'Ventas Contado'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl md:text-3xl font-bold text-green-600 mb-4">
                      S/. {ventasCaja.reduce((acc, v) => acc + Number(v.total_amount), 0).toFixed(2)}
                    </div>
                    <p className="text-sm text-gray-500">{ventasCaja.length} ventas filtradas</p>
                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                      {ventasCaja.slice(0, 5).map(v => (
                        <div key={v.id} className="flex justify-between text-sm border-b pb-2">
                          <span className="text-gray-600">#{v.id} - {new Date(v.created_at).toLocaleDateString()}</span>
                          <span className="font-medium">S/. {Number(v.total_amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Ventas Pedido */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                      <Package className="h-5 w-5 text-blue-500" />
                      Ventas Pedido (Crédito)
                    </CardTitle>
                    <CardDescription>Ventas a clientes con deuda</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl md:text-3xl font-bold text-blue-600 mb-4">
                      S/. {ventasPedido.reduce((acc, v) => acc + Number(v.total_amount), 0).toFixed(2)}
                    </div>
                    <p className="text-sm text-gray-500">{ventasPedido.length} pedidos filtrados</p>
                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                      {ventasPedido.slice(0, 5).map(v => (
                        <div key={v.id} className="flex justify-between text-sm border-b pb-2">
                          <span className="text-gray-600">Pedido #{v.id}</span>
                          <span className="font-medium">S/. {Number(v.total_amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="ingresos" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Stock Actual */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base md:text-lg">Stock Actual en Almacén</CardTitle>
                    <CardDescription>Javas disponibles por producto</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl md:text-3xl font-bold text-primary mb-4">
                      {totalStockJavas.toFixed(2)} javas
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {stock.filter(s => Number(s.stock_javas || 0) > 0).map(s => (
                        <div key={s.product_id} className="flex justify-between items-center">
                          <span className="text-gray-600 text-sm">{s.full_name || s.name}</span>
                          <span className={`font-medium ${Number(s.stock_javas) <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                            {Number(s.stock_javas).toFixed(2)} javas
                          </span>
                        </div>
                      ))}
                      {stock.filter(s => Number(s.stock_javas || 0) > 0).length === 0 && (
                        <p className="text-gray-500 text-center py-4">No hay stock disponible</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Últimos Ingresos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base md:text-lg">Últimos Ingresos</CardTitle>
                    <CardDescription>Mercadería recibida recientemente</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {ingresos.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No hay ingresos registrados</p>
                      ) : (
                        ingresos.slice(0, 10).map(lote => (
                          <div key={lote.id} className="border-b pb-3">
                            <div className="flex justify-between">
                              <span className="font-medium text-sm">Lote #{lote.id}</span>
                              <span className="text-primary">{Number(lote.total_javas || 0).toFixed(2)} javas</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                              <span>{Number(lote.total_kg || 0).toFixed(1)} kg</span>
                              <span>Costo: S/. {Number(lote.total_cost || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="deudas" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Users className="h-5 w-5" />
                    Saldos Pendientes por Cliente
                  </CardTitle>
                  <CardDescription>Deudas acumuladas en ventas tipo Pedido</CardDescription>
                </CardHeader>
                <CardContent>
                  {clients.filter(c => Number(c.current_debt) > 0).length === 0 ? (
                    <p className="text-gray-500 text-center py-8">🎉 No hay deudas pendientes</p>
                  ) : (
                    <div className="space-y-3">
                      {clients
                        .filter(c => Number(c.current_debt) > 0)
                        .sort((a, b) => Number(b.current_debt) - Number(a.current_debt))
                        .map(c => (
                          <div key={c.id} className="flex justify-between items-center p-3 md:p-4 border rounded-lg">
                            <span className="font-medium text-sm md:text-base">{c.name}</span>
                            <span className="text-lg md:text-xl font-bold text-red-600">
                              S/. {Number(c.current_debt).toFixed(2)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
