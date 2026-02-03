'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2, Coins, CreditCard, Banknote, RefreshCw, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ReportData {
  date: string;
  total_sales: number;
  transaction_count: number;
  total_credit: number;
  methods: Record<string, number>;
}

export function DailyReportDialog() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_daily_report', {
        p_date: format(date, 'yyyy-MM-dd')
      });

      if (error) throw error;
      setReport(data as ReportData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchReport();
    }
  }, [open, date]);

  // Totales calculados
  const cashTotal = report?.methods['EFECTIVO'] || 0;
  const digitalTotal = (report?.methods['YAPE'] || 0) + (report?.methods['PLIN'] || 0) + (report?.methods['TRANSFERENCIA'] || 0);
  const creditTotal = report?.total_credit || 0;
  // Total Income (real money) vs Total Sales (nominal)
  // Total Income = Cash + Digital
  const totalIncome = cashTotal + digitalTotal;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Coins className="h-4 w-4 text-yellow-600" />
          <span>Cierre de Caja</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            📊 Reporte Diario de Caja
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          {/* Controls */}
          <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Fecha:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchReport} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : report ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <Banknote className="h-8 w-8 text-green-600 mb-2" />
                    <p className="text-sm font-medium text-green-800">Efectivo en Caja</p>
                    <h3 className="text-2xl font-bold text-green-900">S/ {cashTotal.toFixed(2)}</h3>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                   <CardContent className="p-6 flex flex-col items-center text-center">
                    <CreditCard className="h-8 w-8 text-purple-600 mb-2" />
                    <p className="text-sm font-medium text-purple-800">Total Digital</p>
                    <h3 className="text-2xl font-bold text-purple-900">S/ {digitalTotal.toFixed(2)}</h3>
                    <div className="flex gap-2 text-xs text-purple-700 mt-1">
                      <span>Yape: {(report.methods['YAPE'] || 0).toFixed(0)}</span>
                      <span>•</span>
                      <span>Plin: {(report.methods['PLIN'] || 0).toFixed(0)}</span>
                      <span>•</span>
                      <span>Transf: {(report.methods['TRANSFERENCIA'] || 0).toFixed(0)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                   <CardContent className="p-6 flex flex-col items-center text-center">
                    <Wallet className="h-8 w-8 text-blue-600 mb-2" />
                    <p className="text-sm font-medium text-blue-800">Crédito Otorgado</p>
                    <h3 className="text-2xl font-bold text-blue-900">S/ {creditTotal.toFixed(2)}</h3>
                  </CardContent>
                </Card>
              </div>

              {/* Big Totals */}
              <div className="grid grid-cols-2 gap-8 border-t pt-6">
                 <div>
                    <h4 className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Resumen General</h4>
                    <div className="flex justify-between py-1 border-b">
                        <span>Ventas Totales (Nominal)</span>
                        <span className="font-medium">S/ {report.total_sales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                        <span>Transacciones</span>
                        <span className="font-medium">{report.transaction_count}</span>
                    </div>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Balance Real</h4>
                    <div className="flex justify-between items-center mb-2">
                        <span>Dinero Recaudado (Efectivo + Digital)</span>
                        <span className="text-xl font-bold text-primary">S/ {totalIncome.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        * Este es el dinero que realmente ingresó hoy, sumando ventas al contado y pagos a cuenta.
                    </p>
                 </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No hay datos para mostrar
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
