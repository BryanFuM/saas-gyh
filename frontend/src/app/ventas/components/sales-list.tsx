'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Printer, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Sale {
  id: number;
  date: string;
  type: string;
  total_amount: string;
  user_id: number;
  client_id?: number;
  is_printed: boolean;
}

export function SalesList({ refreshKey }: { refreshKey: number }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filter, setFilter] = useState('');
  const { token, user } = useAuthStore();

  useEffect(() => {
    fetchSales();
  }, [refreshKey]);

  const fetchSales = async () => {
    try {
      const res = await fetch('/api/python/ventas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSales(await res.json());
    } catch (error) {}
  };

  const canEdit = (sale: Sale) => {
    if (user?.role === 'ADMIN') return true;
    const isToday = new Date(sale.date).toDateString() === new Date().toDateString();
    return user?.role === 'VENDEDOR' && isToday;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-400" />
        <Input 
          placeholder="Filtrar por ID o Cliente..." 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No hay ventas registradas hoy.
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">#{sale.id}</TableCell>
                  <TableCell>{new Date(sale.date).toLocaleTimeString()}</TableCell>
                  <TableCell>
                    <Badge variant={sale.type === 'PEDIDO' ? 'outline' : 'secondary'}>
                      {sale.type}
                    </Badge>
                  </TableCell>
                  <TableCell>S/ {parseFloat(sale.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    {sale.is_printed ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Impreso</Badge>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon">
                      <Printer className="h-4 w-4" />
                    </Button>
                    {canEdit(sale) && (
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
