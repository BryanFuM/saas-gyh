'use client';

import { useState } from 'react';
// ✅ Usar el nuevo formulario conectado a Supabase
import { SaleFormSupabase } from './components/sale-form-supabase';
import { SalesList } from './components/sales-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function VentasPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaleSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Módulo de Ventas</h1>
        <p className="text-sm md:text-base text-muted-foreground">Gestiona ventas de caja y pedidos a crédito.</p>
      </div>

      <Tabs defaultValue="nueva" className="space-y-4">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="nueva" className="flex-1 md:flex-none">Nueva Venta</TabsTrigger>
          <TabsTrigger value="hoy" className="flex-1 md:flex-none">Ventas de Hoy</TabsTrigger>
        </TabsList>
        
        <TabsContent value="nueva" className="space-y-4">
          <SaleFormSupabase onSuccess={handleSaleSuccess} />
        </TabsContent>
        
        <TabsContent value="hoy" className="space-y-4">
          <SalesList refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
