'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PackageSearch, CheckCircle, Phone } from 'lucide-react';

interface VentaItem {
  id: number;
  product_id: number;
  quantity_javas: number;
  unit_sale_price: number;
}

interface Pedido {
  id: number;
  type: string;
  client_id: number | null;
  client_name: string | null;
  total_amount: number;
  created_at: string;
  items: VentaItem[];
}

export default function PedidosPage() {
  const { token } = useAuthStore();
  const { toast } = useToast();
  
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPedidos();
  }, []);

  const fetchPedidos = async () => {
    try {
      const response = await fetch('/api/python/ventas?type=PEDIDO', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPedidos(data);
      }
    } catch (error) {
      console.error('Error fetching pedidos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsDelivered = async (pedidoId: number) => {
    toast({
      title: "Funcionalidad próxima",
      description: "Marcar como entregado estará disponible pronto",
    });
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <PackageSearch className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Gestión de Pedidos</h1>
          <p className="text-gray-500">Pedidos pendientes de entrega (ventas a crédito)</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : pedidos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PackageSearch className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No hay pedidos pendientes</p>
            <p className="text-gray-400 text-sm">Los pedidos aparecerán aquí cuando se registren ventas tipo "Pedido"</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pedidos.map((pedido) => (
            <Card key={pedido.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      Pedido #{pedido.id} - {pedido.client_name || 'Sin cliente'}
                    </CardTitle>
                    <CardDescription>
                      {new Date(pedido.created_at).toLocaleString('es-PE')}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">Pendiente</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  {pedido.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>Producto #{item.product_id} x {item.quantity_javas} javas</span>
                      <span>S/. {(item.quantity_javas * item.unit_sale_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-4 border-t">
                  <div>
                    <span className="text-lg font-bold">Total: S/. {Number(pedido.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Phone className="h-4 w-4 mr-2" />
                      Contactar
                    </Button>
                    <Button size="sm" onClick={() => markAsDelivered(pedido.id)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marcar Entregado
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
