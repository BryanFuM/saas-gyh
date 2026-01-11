'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, DollarSign, Package, TrendingUp, Users, ShoppingCart, Truck } from 'lucide-react';

interface Venta {
  id: number;
  type: string;
  total_amount: number;
  date: string;
  client_id: number | null;
}

interface Ingreso {
  id: number;
  supplier_name: string;
  total_kg: number;
  total_javas: number;
  unit_cost_price: number;
  date: string;
}

interface Client {
  id: number;
  name: string;
  current_debt: number;
}

interface StockItem {
  product_id: number;
  product_name: string;
  total_javas_available: number;
}

export default function ReportesPage() {
  const { token, user, isHydrated, hydrate } = useAuthStore();
  
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      fetchAllData();
    }
  }, [token, user]);

  const fetchAllData = async () => {
    try {
      const [ventasRes, ingresosRes, clientsRes, stockRes] = await Promise.all([
        fetch('/api/python/ventas', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/python/ingresos', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/python/clients', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/python/ingresos/stock/disponible', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      if (ventasRes.ok) setVentas(await ventasRes.json());
      if (ingresosRes.ok) setIngresos(await ingresosRes.json());
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (stockRes.ok) setStock(await stockRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculations
  const ventasCaja = ventas.filter(v => v.type === 'CAJA');
  const ventasPedido = ventas.filter(v => v.type === 'PEDIDO');
  
  const totalCaja = ventasCaja.reduce((acc, v) => acc + Number(v.total_amount), 0);
  const totalPedido = ventasPedido.reduce((acc, v) => acc + Number(v.total_amount), 0);
  const totalVentas = totalCaja + totalPedido;
  
  const totalCostoCompra = ingresos.reduce((acc, i) => acc + (i.total_javas * i.unit_cost_price), 0);
  const totalDeudaPendiente = clients.reduce((acc, c) => acc + Number(c.current_debt), 0);
  const totalStockJavas = stock.reduce((acc, s) => acc + s.total_javas_available, 0);
  
  // Ganancia Neta = Ventas - Costo de lo vendido (simplificado)
  const gananciaNeta = totalVentas - totalCostoCompra;

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Reportes</h1>
          <p className="text-gray-500">Consolidado de operaciones del sistema</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* KPIs Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Ventas</CardTitle>
                <ShoppingCart className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">S/. {totalVentas.toFixed(2)}</div>
                <p className="text-xs text-gray-500 mt-1">{ventas.length} transacciones</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Costo Compras</CardTitle>
                <Truck className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">S/. {totalCostoCompra.toFixed(2)}</div>
                <p className="text-xs text-gray-500 mt-1">{ingresos.length} ingresos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Ganancia Neta</CardTitle>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${gananciaNeta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  S/. {gananciaNeta.toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Ventas - Costos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Deuda Total</CardTitle>
                <DollarSign className="h-5 w-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">S/. {totalDeudaPendiente.toFixed(2)}</div>
                <p className="text-xs text-gray-500 mt-1">Por cobrar</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs de Reportes Detallados */}
          <Tabs defaultValue="ventas" className="space-y-4">
            <TabsList>
              <TabsTrigger value="ventas">Ventas</TabsTrigger>
              <TabsTrigger value="ingresos">Ingresos & Stock</TabsTrigger>
              <TabsTrigger value="deudas">Deudas Clientes</TabsTrigger>
            </TabsList>

            <TabsContent value="ventas" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ventas Caja */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      Ventas Caja (Contado)
                    </CardTitle>
                    <CardDescription>Ventas con pago inmediato</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 mb-4">
                      S/. {totalCaja.toFixed(2)}
                    </div>
                    <p className="text-sm text-gray-500">{ventasCaja.length} ventas realizadas</p>
                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                      {ventasCaja.slice(0, 5).map(v => (
                        <div key={v.id} className="flex justify-between text-sm border-b pb-2">
                          <span className="text-gray-600">Venta #{v.id}</span>
                          <span className="font-medium">S/. {Number(v.total_amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Ventas Pedido */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-500" />
                      Ventas Pedido (Crédito)
                    </CardTitle>
                    <CardDescription>Ventas a clientes con deuda</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 mb-4">
                      S/. {totalPedido.toFixed(2)}
                    </div>
                    <p className="text-sm text-gray-500">{ventasPedido.length} pedidos registrados</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stock Actual */}
                <Card>
                  <CardHeader>
                    <CardTitle>Stock Actual en Almacén</CardTitle>
                    <CardDescription>Javas disponibles por producto</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary mb-4">
                      {totalStockJavas.toFixed(2)} javas
                    </div>
                    <div className="space-y-3">
                      {stock.map(s => (
                        <div key={s.product_id} className="flex justify-between items-center">
                          <span className="text-gray-600">{s.product_name}</span>
                          <span className={`font-medium ${s.total_javas_available <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                            {Number(s.total_javas_available).toFixed(2)} javas
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Últimos Ingresos */}
                <Card>
                  <CardHeader>
                    <CardTitle>Últimos Ingresos</CardTitle>
                    <CardDescription>Mercadería recibida recientemente</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {ingresos.slice(0, 10).map(i => (
                        <div key={i.id} className="border-b pb-3">
                          <div className="flex justify-between">
                            <span className="font-medium">{i.supplier_name}</span>
                            <span className="text-primary">{Number(i.total_javas).toFixed(2)} javas</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>{i.total_kg} kg</span>
                            <span>S/. {i.unit_cost_price}/java</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="deudas" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Saldos Pendientes por Cliente
                  </CardTitle>
                  <CardDescription>Deudas acumuladas en ventas tipo Pedido</CardDescription>
                </CardHeader>
                <CardContent>
                  {clients.filter(c => Number(c.current_debt) > 0).length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay deudas pendientes</p>
                  ) : (
                    <div className="space-y-3">
                      {clients
                        .filter(c => Number(c.current_debt) > 0)
                        .sort((a, b) => Number(b.current_debt) - Number(a.current_debt))
                        .map(c => (
                          <div key={c.id} className="flex justify-between items-center p-4 border rounded-lg">
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xl font-bold text-red-600">
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
