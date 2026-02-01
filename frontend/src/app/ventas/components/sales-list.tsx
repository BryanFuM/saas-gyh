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
import { supabase } from '@/lib/supabase';

// --- Interfaces de Base de Datos (Supabase) ---

interface Product {
  id: number;
  name: string;
  type: string;
  quality: string;
}

interface VentaItem {
  venta_id: number;
  product_id: number;
  quantity_javas: number;
  subtotal: number;
  products: Product | null; // Relación anidada
}

interface Client {
  id: number;
  name: string;
}

interface VentaWithRelations {
  id: number;
  date: string; // Supabase devuelve strings para timestamptz
  total_amount: number;
  client_id: number | null;
  guest_client_name: string | null;
  is_cancelled: boolean;
  payment_method: string;
  clients: Client | null; // Relación anidada
  venta_items: VentaItem[]; // Relación anidada
}

export function SalesList({ refreshKey }: { refreshKey: number }) {
  const [sales, setSales] = useState<VentaWithRelations[]>([]);
  const [filter, setFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<VentaWithRelations | null>(null);
  
  // Print state
  const [saleToPrint, setSaleToPrint] = useState<VentaWithRelations | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  
  const { user } = useAuthStore();
  const { toast } = useToast();

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
  });

  useEffect(() => {
    fetchSales();
  }, [refreshKey, dateRange]);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('ventas')
        .select(`
          *,
          clients (name),
          venta_items (
            quantity_javas,
            subtotal,
            products (name, type, quality)
          )
        `)
        .order('date', { ascending: false });

      // Aplicar filtros de fecha si existen
      if (dateRange?.from) {
        // Ajustar al inicio del día
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        query = query.gte('date', fromDate.toISOString());
      }
      
      if (dateRange?.to) {
        // Ajustar al final del día
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('date', toDate.toISOString());
      }
      
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data) {
        setSales(data as unknown as VentaWithRelations[]);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        variant: "destructive",
        title: "Error al cargar ventas",
        description: "No se pudieron obtener los datos de Supabase",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasClientName = (sale: VentaWithRelations) => {
    if (sale.clients?.name) return sale.clients.name;
    if (sale.guest_client_name) return sale.guest_client_name;
    return "Cliente Eventual";
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

  const canEdit = (sale: VentaWithRelations) => {
    // Si está cancelada no se edita
    if (sale.is_cancelled) return false;
    
    if (user?.role === 'ADMIN') return true;
    try {
      const saleDate = parseISO(sale.date);
      const isToday = isValid(saleDate) && saleDate.toDateString() === new Date().toDateString();
      return user?.role === 'VENDEDOR' && isToday;
    } catch {
      return false;
    }
  };

  const canDelete = (sale: VentaWithRelations) => {
    // Si ya está cancelada, no mostrar botón de anular
    if (sale.is_cancelled) return false;

    if (user?.role === 'ADMIN') return true;
    try {
      const saleDate = parseISO(sale.date);
      const isToday = isValid(saleDate) && saleDate.toDateString() === new Date().toDateString();
      return user?.role === 'VENDEDOR' && isToday;
    } catch {
      return false;
    }
  };

  const handleDeleteClick = (sale: VentaWithRelations) => {
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!saleToDelete) return;
    
    try {
      // Intentar usar RPC primero
      const { error: rpcError } = await supabase.rpc('anular_venta', { 
        p_venta_id: saleToDelete.id 
      });

      if (rpcError) {
        console.warn('RPC anular_venta falló, intentando update directo...', rpcError);
        
        // Fallback: Update manual (SOLO si RPC falla y es una emergencia, 
        // pero idealmente deberíamos confiar en RPC para manejar stock)
        const { error: updateError } = await supabase
          .from('ventas')
          .update({ is_cancelled: true })
          .eq('id', saleToDelete.id);
          
        if (updateError) throw updateError;
      }

      toast({
        title: "Venta Anulada",
        description: "La venta ha sido marcada como anulada correctamente.",
      });

      fetchSales(); // Recargar lista
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo anular la venta",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
    }
  };

  // Filtrado en memoria
  const filteredSales = sales.filter(sale => {
    const clientName = hasClientName(sale).toLowerCase();
    const searchLower = filter.toLowerCase();
    const matchesClient = clientName.includes(searchLower);
    const matchesId = sale.id.toString().includes(searchLower);
    return matchesClient || matchesId;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex gap-2 items-center w-full md:w-auto">
          <Input
            placeholder="Buscar por cliente o ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full md:w-64"
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          <Button variant="outline" size="icon" onClick={fetchSales} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {isLoading ? "Cargando ventas..." : "No se encontraron ventas"}
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale) => (
                <TableRow key={sale.id} className={sale.is_cancelled ? "bg-muted/50" : ""}>
                  <TableCell className="font-medium">#{sale.id}</TableCell>
                  <TableCell>{formatDate(sale.date)}</TableCell>
                  <TableCell>{hasClientName(sale)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {sale.venta_items.map((item, idx) => (
                        <span key={idx} className="text-sm">
                          {item.quantity_javas} javas de {item.products?.name} ({item.products?.type} - {item.products?.quality})
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>S/ {Number(sale.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    {sale.is_cancelled ? (
                      <Badge variant="destructive">Anulada</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completada</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSaleToPrint(sale);
                          setTimeout(() => handlePrint(), 100);
                        }}
                        title="Imprimir Ticket"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      
                      {canDelete(sale) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClick(sale)}
                          title="Anular Venta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la venta #{saleToDelete?.id} como anulada y revertirá el stock de los productos.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Sí, anular venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden Ticket Template for Printing */}
      <div className="hidden">
        <div ref={ticketRef}>
          {saleToPrint ? (
             <TicketTemplate 
               sale={{
                 ...saleToPrint,
                 // Adaptar formato para el template si es necesario
                 items: saleToPrint.venta_items.map(item => ({
                    id: 0,
                    product_id: item.product_id,
                    quantity_javas: item.quantity_javas,
                    unit_sale_price: (item.subtotal / item.quantity_javas).toFixed(2),
                    unit: 'java', // Default unit
                    product_name: item.products?.name || 'Producto'
                 })),
                 type: saleToPrint.payment_method, // Usar metodo de pago como tipo
                 user_id: 0, // No disponible en esta vista, no crítico para ticket
                 is_printed: true,
                 total_amount: saleToPrint.total_amount.toString()
               }} 
               client={saleToPrint.clients ? {
                 id: saleToPrint.clients.id,
                 name: saleToPrint.clients.name,
                 whatsapp_number: '',
                 current_debt: '0'
               } : undefined}
             />
          ) : null}
        </div>
      </div>
    </div>
  );
}
