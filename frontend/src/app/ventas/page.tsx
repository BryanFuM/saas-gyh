'use client';

import { useState } from 'react';
import { SaleForm } from './components/sale-form';
import { SalesList } from './components/sales-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function VentasPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaleSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Módulo de Ventas</h1>
        <p className="text-muted-foreground">Gestiona ventas de caja y pedidos a crédito.</p>
      </div>

      <Tabs defaultValue="nueva" className="space-y-4">
        <TabsList>
          <TabsTrigger value="nueva">Nueva Venta</TabsTrigger>
          <TabsTrigger value="hoy">Ventas de Hoy</TabsTrigger>
        </TabsList>
        
        <TabsContent value="nueva" className="space-y-4">
          <SaleForm onSuccess={handleSaleSuccess} />
        </TabsContent>
        
        <TabsContent value="hoy" className="space-y-4">
          <SalesList refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
