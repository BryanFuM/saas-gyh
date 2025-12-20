'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
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
import { useToast } from '@/hooks/use-toast';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit, Printer, Search, Trash2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TicketTemplate } from './ticket-template';
import { useReactToPrint } from 'react-to-print';

interface SaleItem {
  id: number;
  product_id: number;
  quantity_javas: number;
  quantity_original?: number;
  unit?: string;
  unit_sale_price: string;
}

interface Sale {
  id: number;
  date: string;
  type: string;
  total_amount: string;
  user_id: number;
  client_id?: number;
  is_printed: boolean;
  items: SaleItem[];
}

interface Client {
  id: number;
  name: string;
  whatsapp_number: string;
  current_debt: string;
}

export function SalesList({ refreshKey }: { refreshKey: number }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  
  // Print state
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  
  const { token, user } = useAuthStore();
  const { toast } = useToast();

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
  });

  useEffect(() => {
    fetchSales();
    fetchClients();
  }, [refreshKey, dateRange]);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/python/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setClients(await res.json());
    } catch (error) {}
  };

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      let url = '/api/python/ventas';
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        params.append('start_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        params.append('end_date', format(dateRange.to, 'yyyy-MM-dd'));
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSales(await res.json());
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getClientById = (clientId?: number): Client | undefined => {
    if (!clientId) return undefined;
    return clients.find(c => c.id === clientId);
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return 'Fecha inválida';
      return format(date, "dd MMM yyyy HH:mm", { locale: es });
    } catch {
      return 'Fecha inválida';
    }
  };

  const canEdit = (sale: Sale) => {
    if (user?.role === 'ADMIN') return true;
    try {
      const saleDate = parseISO(sale.date);
      const isToday = isValid(saleDate) && saleDate.toDateString() === new Date().toDateString();
      return user?.role === 'VENDEDOR' && isToday;
    } catch {
      return false;
    }
  };

  const canDelete = (sale: Sale) => {
    if (user?.role === 'ADMIN') return true;
    try {
      const saleDate = parseISO(sale.date);
      const isToday = isValid(saleDate) && saleDate.toDateString() === new Date().toDateString();
      return user?.role === 'VENDEDOR' && isToday;
    } catch {
      return false;
    }
  };

  const handleDeleteClick = (sale: Sale) => {
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!saleToDelete) return;
    
    try {
      const res = await fetch(`/api/python/ventas/${saleToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Error al eliminar');
      }

      toast({
        title: "Venta Eliminada",
        description: saleToDelete.type === 'PEDIDO' 
          ? "La deuda del cliente ha sido revertida automáticamente"
          : "La venta ha sido eliminada y el stock restaurado",
      });

      fetchSales();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
    }
  };

  const handlePrintClick = (sale: Sale) => {
    setSaleToPrint(sale);
    setTimeout(() => {
      handlePrint();
    }, 300);
  };

  // Filter sales by ID or client name
  const filteredSales = sales.filter(sale => {
    if (!filter) return true;
    const searchLower = filter.toLowerCase();
    const client = getClientById(sale.client_id);
    return (
      sale.id.toString().includes(searchLower) ||
      client?.name.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Filtrar por ID o Cliente..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        {user?.role === 'ADMIN' && (
          <div className="flex items-center gap-2">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => fetchSales()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No hay ventas registradas para el período seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale) => {
                const client = getClientById(sale.client_id);
                return (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">#{sale.id}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(sale.date)}</TableCell>
                    <TableCell>
                      <Badge variant={sale.type === 'PEDIDO' ? 'outline' : 'secondary'}>
                        {sale.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{client?.name || '-'}</TableCell>
                    <TableCell>S/ {parseFloat(sale.total_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      {sale.is_printed ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Impreso</Badge>
                      ) : (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handlePrintClick(sale)}
                          title="Reimprimir"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {canEdit(sale) && (
                          <Button variant="ghost" size="icon" title="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete(sale) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteClick(sale)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar venta #{saleToDelete?.id}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta acción no se puede deshacer.</p>
              {saleToDelete?.type === 'PEDIDO' && (
                <p className="text-amber-600 font-medium">
                  ⚠️ La deuda del cliente será revertida automáticamente (S/ {parseFloat(saleToDelete?.total_amount || '0').toFixed(2)}).
                </p>
              )}
              <p>El stock de los productos será restaurado automáticamente.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar Venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden Ticket for Reprinting */}
      <div className="hidden">
        <TicketTemplate 
          ref={ticketRef} 
          sale={saleToPrint} 
          client={saleToPrint ? getClientById(saleToPrint.client_id) || null : null} 
        />
      </div>
    </div>
  );
}
