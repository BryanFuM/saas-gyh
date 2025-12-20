'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, Users, TrendingUp } from 'lucide-react';

interface StockItem {
  product_id: number;
  product_name: string;
  total_javas_available: number;
}

export default function HomePage() {
  const { user, token, isHydrated, hydrate } = useAuthStore();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token) {
      fetchStock();
    }
  }, [token]);

  const fetchStock = async () => {
    try {
      const response = await fetch('/api/python/ingresos/stock', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStock(data);
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Bienvenido, {user.username}</h1>
        <p className="text-sm md:text-base text-gray-500">Panel de control - Sistema ByH</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Stock Total</CardTitle>
            <Package className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stock.reduce((acc, item) => acc + item.total_javas_available, 0).toFixed(0)} javas
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Productos</CardTitle>
            <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold">{stock.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Tu Rol</CardTitle>
            <Users className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold">{user.role}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Estado</CardTitle>
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-xl md:text-2xl font-bold text-green-600">Activo</div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Overview */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Stock Actual por Producto</CardTitle>
          <CardDescription>Inventario disponible en javas</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : stock.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay stock registrado. Registra ingresos de mercadería para ver el stock.</p>
          ) : (
            <div className="space-y-4">
              {stock.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${item.total_javas_available <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                      {item.total_javas_available.toFixed(2)} javas
                    </p>
                    {item.total_javas_available <= 10 && (
                      <p className="text-xs text-red-500">Stock bajo</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
