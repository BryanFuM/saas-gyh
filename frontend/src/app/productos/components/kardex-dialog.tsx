'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { Loader2, ScrollText, ArrowDownCircle, ArrowUpCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface KardexItem {
  fecha: string;
  tipo: string;
  referencia: string;
  entrada_javas: number;
  salida_javas: number;
  saldo_javas: number;
  kilos_ref: number;
}

interface KardexDialogProps {
  productId: number;
  productName: string;
}

export function KardexDialog({ productId, productName }: KardexDialogProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KardexItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKardex = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_product_kardex', {
        p_product_id: productId
      });
      
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const safeFormatDate = (dateStr: string) => {
    if (!dateStr) return 'Sin fecha';
    try {
      const d = new Date(dateStr);
      // Validar si es una fecha válida
      if (isNaN(d.getTime())) return 'Fecha inválida';
      return format(d, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return 'Error fecha';
    }
  };

  useEffect(() => {
    if (open && productId) {
      fetchKardex();
    }
  }, [open, productId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ScrollText className="h-4 w-4" />
          Kárdex
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kárdex: {productName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right text-green-600">Entrada</TableHead>
                <TableHead className="text-right text-red-600">Salida</TableHead>
                <TableHead className="text-right font-bold">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {safeFormatDate(item.fecha)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                          item.tipo === 'INGRESO' ? 'default' : 
                          item.tipo === 'VENTA' ? 'secondary' : 
                          item.tipo === 'ANULACION' ? 'destructive' : 'outline'
                        }
                        className={
                          item.tipo === 'INGRESO' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                          item.tipo === 'VENTA' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                          item.tipo === 'ANULACION' ? 'bg-red-100 text-red-800 hover:bg-red-100' : ''
                        }
                      >
                        {item.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.referencia}</TableCell>
                    <TableCell className="text-right">
                      {item.entrada_javas > 0 ? `+${item.entrada_javas}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.salida_javas > 0 ? `-${item.salida_javas}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {item.saldo_javas}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
