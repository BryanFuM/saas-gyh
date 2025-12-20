'use client';

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface SalesSummaryProps {
  sales: any[];
}

export function SalesSummary({ sales }: SalesSummaryProps) {
  const cajaSales = sales.filter(s => s.type === 'CAJA');
  const pedidoSales = sales.filter(s => s.type === 'PEDIDO');

  const totalCaja = cajaSales.reduce((acc, s) => acc + parseFloat(s.total_amount), 0);
  const totalPedido = pedidoSales.reduce((acc, s) => acc + parseFloat(s.total_amount), 0);
  
  const totalJavasCaja = cajaSales.reduce((acc, s) => 
    acc + s.items.reduce((sum: number, item: any) => sum + item.quantity_javas, 0), 0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Caja (Hoy)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">S/ {totalCaja.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{totalJavasCaja} Javas vendidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pedidos (Crédito)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">S/ {totalPedido.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{pedidoSales.length} pedidos registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {(totalCaja + totalPedido).toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="caja" className="w-full">
        <TabsList>
          <TabsTrigger value="caja">Ventas Caja</TabsTrigger>
          <TabsTrigger value="pedido">Ventas Pedido</TabsTrigger>
        </TabsList>
        
        <TabsContent value="caja">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cajaSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>#{sale.id}</TableCell>
                    <TableCell>{new Date(sale.date).toLocaleTimeString()}</TableCell>
                    <TableCell>
                      {sale.items.map((i: any) => `${i.quantity_javas}j`).join(', ')}
                    </TableCell>
                    <TableCell className="text-right font-medium">S/ {parseFloat(sale.total_amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pedido">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidoSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>#{sale.id}</TableCell>
                    <TableCell>{sale.client_name || `Cliente ${sale.client_id}`}</TableCell>
                    <TableCell>{new Date(sale.date).toLocaleTimeString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Pendiente</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">S/ {parseFloat(sale.total_amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
