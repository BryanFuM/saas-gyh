'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { SalesSummary } from '../components/sales-summary';
import { calculateNetProfit } from '../components/profit-calculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  AlertTriangle 
} from 'lucide-react';

export default function AdminDashboard() {
  const [sales, setSales] = useState<any[]>([]);
  const [ingresos, setIngresos] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuthStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, ingresosRes, stockRes] = await Promise.all([
        fetch('/api/python/ventas', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/python/ingresos', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/python/ingresos/stock/disponible', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (salesRes.ok) setSales(await salesRes.json());
      if (ingresosRes.ok) setIngresos(await ingresosRes.json());
      if (stockRes.ok) setStock(await stockRes.json());
    } catch (error) {
      console.error("Error fetching dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const profitData = calculateNetProfit(sales, ingresos);

  // Prepare chart data (last 7 days)
  const chartData = [
    { name: 'Ventas', value: profitData.revenue, fill: '#10b981' },
    { name: 'Costos', value: profitData.cost, fill: '#ef4444' },
    { name: 'Utilidad', value: profitData.profit, fill: '#3b82f6' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de Administración</h1>
          <p className="text-muted-foreground">Resumen consolidado de ingresos, ventas y rentabilidad.</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              S/ {profitData.profit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Margen: {profitData.margin.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stock.reduce((acc, s) => acc + s.total_javas_available, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Javas en almacén</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ingresos (Costo)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">S/ {profitData.cost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Inversión en mercadería</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ventas (Bruto)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">S/ {profitData.revenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Ingresos por ventas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Rendimiento Financiero</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `S/ ${Number(value).toFixed(2)}`} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Estado de Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stock.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">ID: {item.product_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{Number(item.total_javas_available).toFixed(1)} javas</p>
                    {item.total_javas_available < 10 && (
                      <Badge variant="destructive" className="text-[10px]">Stock Bajo</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Sales Summary */}
      <SalesSummary sales={sales} />
    </div>
  );
}
