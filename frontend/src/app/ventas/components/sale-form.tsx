'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductSelect, ClientSelect } from '@/components/ui/searchable-select';
import { Plus, Trash2, Printer, Save, Scale, UserPlus } from 'lucide-react';
import { TicketTemplate } from './ticket-template';
import { useReactToPrint } from 'react-to-print';
import { useProducts } from '@/hooks/use-products';
import { useClients, useCreateClient } from '@/hooks/use-clients';
import { useStock } from '@/hooks/use-ingresos';
import { useCreateVenta } from '@/hooks/use-ventas';
import type { Client, VentaItemCreate } from '@/lib/api';

interface SaleItem {
  id: string; // Unique ID for React key
  product_id: number | null;
  quantity_kg: string; // String to handle input properly
  price_per_kg: string; // String to handle input properly
}

const createEmptyItem = (): SaleItem => ({
  id: crypto.randomUUID(),
  product_id: null,
  quantity_kg: '',
  price_per_kg: '',
});

/**
 * Parse a numeric string, removing leading zeros except for decimals.
 * Handles "05" -> "5", "00.5" -> "0.5", etc.
 */
const parseNumericInput = (value: string): string => {
  // Allow empty input
  if (!value) return '';
  
  // Remove leading zeros except if it's "0." for decimals
  const cleaned = value.replace(/^0+(?=\d)/, '');
  
  // If user typed just "0", keep it
  if (value === '0' || cleaned === '') return value === '0' ? '0' : '';
  
  return cleaned;
};

export function SaleForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  
  // React Query hooks
  const { data: products = [] } = useProducts();
  const { data: clients = [], refetch: refetchClients } = useClients();
  const { data: stock = [] } = useStock();
  const createVenta = useCreateVenta();
  const createClientMutation = useCreateClient();
  
  // Form state
  const [mode, setMode] = useState<'CAJA' | 'PEDIDO'>('CAJA');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [items, setItems] = useState<SaleItem[]>([createEmptyItem()]);
  const [lastSale, setLastSale] = useState<any>(null);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [shouldPrintAfterSave, setShouldPrintAfterSave] = useState(false);
  
  // New client modal state
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');
  
  const ticketRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
  });

  // Derived state
  const selectedClient = useMemo(() => 
    clients.find((c: Client) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  // Create stock map for ProductSelect
  const stockMap = useMemo(() => {
    const map: Record<number, number> = {};
    stock.forEach((s: { product_id: number; total_javas_available: number }) => {
      map[s.product_id] = s.total_javas_available;
    });
    return map;
  }, [stock]);

  const getProductById = (productId: number | null) => {
    if (!productId) return undefined;
    return products.find((p: { id: number }) => p.id === productId);
  };

  const getStockForProduct = (productId: number | null): number => {
    if (!productId) return 0;
    return stockMap[productId] || 0;
  };

  // Calculate item values
  const calculateItemValues = useCallback((item: SaleItem) => {
    const quantityKg = parseFloat(item.quantity_kg) || 0;
    const pricePerKg = parseFloat(item.price_per_kg) || 0;
    const product = getProductById(item.product_id);
    const conversionFactor = product?.conversion_factor || 20;
    
    const quantityJavas = quantityKg / conversionFactor;
    const subtotal = quantityKg * pricePerKg;
    
    return { quantityKg, quantityJavas, pricePerKg, subtotal, conversionFactor };
  }, [products]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const values = calculateItemValues(item);
        return {
          kg: acc.kg + values.quantityKg,
          javas: acc.javas + values.quantityJavas,
          amount: acc.amount + values.subtotal,
        };
      },
      { kg: 0, javas: 0, amount: 0 }
    );
  }, [items, calculateItemValues]);

  const addItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof SaleItem, value: string | number | null) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Handle numeric input with proper formatting (fixes "05" bug)
  const handleNumericInput = (index: number, field: 'quantity_kg' | 'price_per_kg', value: string) => {
    // Allow empty, numbers, and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const cleaned = parseNumericInput(value);
      updateItem(index, field, cleaned);
    }
  };

  const resetForm = () => {
    setSelectedClientId(null);
    setItems([createEmptyItem()]);
    setLastSale(null);
    setShouldPrintAfterSave(false);
  };

  const validateSale = (): string | null => {
    if (mode === 'PEDIDO' && !selectedClient) {
      return 'Selecciona un cliente';
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) {
        return `Producto ${i + 1}: Selecciona un producto`;
      }
      const values = calculateItemValues(item);
      if (values.quantityKg <= 0) {
        return `Producto ${i + 1}: Ingresa la cantidad en KG`;
      }
      if (values.pricePerKg <= 0) {
        return `Producto ${i + 1}: Ingresa el precio por KG`;
      }
      
      // Validate stock
      const availableJavas = getStockForProduct(item.product_id);
      if (values.quantityJavas > availableJavas) {
        const product = getProductById(item.product_id);
        return `${product?.name || 'Producto'}: Stock insuficiente. Disponible: ${availableJavas.toFixed(2)} javas (${(availableJavas * values.conversionFactor).toFixed(1)} kg)`;
      }
    }

    return null;
  };

  const handleShowConfirmation = (shouldPrint: boolean) => {
    const error = validateSale();
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error });
      return;
    }
    setShouldPrintAfterSave(shouldPrint);
    setShowConfirmModal(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmModal(false);
    
    const ventaItems: VentaItemCreate[] = items.map(item => ({
      product_id: item.product_id!,
      quantity_kg: parseFloat(item.quantity_kg),
      price_per_kg: parseFloat(item.price_per_kg),
    }));

    try {
      const savedSale = await createVenta.mutateAsync({
        type: mode,
        client_id: mode === 'PEDIDO' ? selectedClientId || undefined : undefined,
        items: ventaItems,
      });

      setLastSale(savedSale);
      
      toast({
        title: 'Venta Exitosa',
        description: mode === 'PEDIDO' ? 'Pedido registrado correctamente' : 'Venta registrada correctamente',
      });

      if (shouldPrintAfterSave) {
        setTimeout(() => handlePrint(), 500);
      }

      onSuccess();
      resetForm();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const createNewClient = async () => {
    if (!newClientName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre es requerido' });
      return;
    }
    
    try {
      const newClient = await createClientMutation.mutateAsync({
        name: newClientName.trim(),
        whatsapp_number: newClientWhatsapp.trim() || undefined,
      });
      
      await refetchClients();
      setSelectedClientId(newClient.id);
      
      toast({ title: 'Éxito', description: `Cliente "${newClientName}" creado` });
      setShowNewClientModal(false);
      setNewClientName('');
      setNewClientWhatsapp('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'CAJA' | 'PEDIDO')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="CAJA" className="text-xs md:text-sm">Caja (Contado)</TabsTrigger>
          <TabsTrigger value="PEDIDO" className="text-xs md:text-sm">Pedido (Crédito)</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <span className="text-lg md:text-xl">Nueva Venta - {mode}</span>
              {mode === 'PEDIDO' && selectedClient && (
                <Badge variant="destructive" className="text-sm md:text-lg px-3 py-1 w-fit">
                  Deuda: S/ {selectedClient.current_debt.toFixed(2)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
            {mode === 'PEDIDO' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Cliente</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewClientModal(true)}
                    className="text-primary h-8"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Nuevo Cliente
                  </Button>
                </div>
                <ClientSelect
                  clients={clients}
                  value={selectedClientId}
                  onSelect={setSelectedClientId}
                  disabled={createVenta.isPending}
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-base md:text-lg font-semibold">Productos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1 md:mr-2" /> 
                  <span className="hidden sm:inline">Agregar</span>
                </Button>
              </div>

              {items.map((item, index) => {
                const values = calculateItemValues(item);
                const stockAvailable = getStockForProduct(item.product_id);
                const stockKg = stockAvailable * values.conversionFactor;
                
                return (
                  <div key={item.id} className="flex flex-col gap-3 border rounded-lg p-4 bg-gray-50/50">
                    <div className="flex-1 space-y-2">
                      <Label className="text-sm">Producto</Label>
                      <ProductSelect
                        products={products}
                        stockMap={stockMap}
                        value={item.product_id}
                        onSelect={(id) => updateItem(index, 'product_id', id)}
                        disabled={createVenta.isPending}
                      />
                      {item.product_id && (
                        <p className="text-xs text-muted-foreground">
                          Stock: {stockAvailable.toFixed(2)} javas ({stockKg.toFixed(1)} kg)
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="w-28 space-y-2">
                        <Label className="text-sm flex items-center gap-1">
                          <Scale className="h-3 w-3" />
                          Cantidad (KG)
                        </Label>
                        <Input 
                          type="text"
                          inputMode="decimal"
                          value={item.quantity_kg}
                          onChange={(e) => handleNumericInput(index, 'quantity_kg', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="w-28 space-y-2">
                        <Label className="text-sm">Precio/KG (S/.)</Label>
                        <Input 
                          type="text"
                          inputMode="decimal"
                          value={item.price_per_kg}
                          onChange={(e) => handleNumericInput(index, 'price_per_kg', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex-1 min-w-[100px] space-y-2">
                        <Label className="text-sm text-muted-foreground">Subtotal</Label>
                        <div className="h-10 flex items-center font-medium text-primary">
                          S/ {values.subtotal.toFixed(2)}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {item.product_id && values.quantityKg > 0 && (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <Scale className="h-3 w-3" />
                        {values.quantityKg} kg = {values.quantityJavas.toFixed(2)} javas
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col items-end gap-4 bg-gray-50 p-6">
            {/* Totals summary */}
            <div className="text-right space-y-1 w-full md:w-auto">
              <p className="text-sm text-gray-500">
                Total: {totals.kg.toFixed(2)} kg ({totals.javas.toFixed(2)} javas)
              </p>
              <p className="text-sm text-gray-500">Subtotal: S/ {totals.amount.toFixed(2)}</p>
              
              {mode === 'PEDIDO' && selectedClient && (
                <>
                  <p className="text-sm text-gray-500">
                    Deuda Anterior: S/ {selectedClient.current_debt.toFixed(2)}
                  </p>
                  <p className="text-xl font-bold text-primary">
                    Nueva Deuda: S/ {(totals.amount + selectedClient.current_debt).toFixed(2)}
                  </p>
                </>
              )}
              {mode === 'CAJA' && (
                <p className="text-xl font-bold text-primary">
                  Total a Pagar: S/ {totals.amount.toFixed(2)}
                </p>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none px-6 py-6 text-base"
                onClick={() => handleShowConfirmation(false)} 
                disabled={createVenta.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Solo Guardar
              </Button>
              <Button 
                className="flex-1 sm:flex-none px-6 py-6 text-base"
                onClick={() => handleShowConfirmation(true)} 
                disabled={createVenta.isPending}
              >
                <Printer className="h-4 w-4 mr-2" />
                {createVenta.isPending ? 'Procesando...' : 'Guardar e Imprimir'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </Tabs>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar Venta</DialogTitle>
            <DialogDescription>Revisa los detalles antes de confirmar</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {mode === 'PEDIDO' && selectedClient && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-medium">Cliente: {selectedClient.name}</p>
                {selectedClient.whatsapp_number && (
                  <p className="text-sm text-gray-600">Tel: {selectedClient.whatsapp_number}</p>
                )}
              </div>
            )}
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio/KG</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const product = getProductById(item.product_id);
                  const values = calculateItemValues(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{product?.name || 'Producto'}</TableCell>
                      <TableCell className="text-right">
                        {values.quantityKg} kg
                        <span className="text-xs text-muted-foreground ml-1">
                          ({values.quantityJavas.toFixed(2)} j)
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        S/ {values.pricePerKg.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        S/ {values.subtotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Venta:</span>
                <span>S/ {totals.amount.toFixed(2)}</span>
              </div>
              
              {mode === 'PEDIDO' && selectedClient && (
                <div className="bg-yellow-50 p-4 rounded-lg space-y-1">
                  <div className="flex justify-between">
                    <span>Deuda Anterior:</span>
                    <span>S/ {selectedClient.current_debt.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Venta Actual:</span>
                    <span>S/ {totals.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Nueva Deuda Total:</span>
                    <span className="text-red-600">
                      S/ {(totals.amount + selectedClient.current_debt).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmedSubmit} disabled={createVenta.isPending}>
              {shouldPrintAfterSave ? (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Confirmar e Imprimir
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Client Modal */}
      <Dialog open={showNewClientModal} onOpenChange={setShowNewClientModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>Crear un nuevo cliente rápidamente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp (opcional)</Label>
              <Input
                value={newClientWhatsapp}
                onChange={(e) => setNewClientWhatsapp(e.target.value)}
                placeholder="+51 999 999 999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={createNewClient} 
              disabled={createClientMutation.isPending || !newClientName.trim()}
            >
              {createClientMutation.isPending ? 'Creando...' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden Ticket for Printing */}
      <div className="hidden">
        <TicketTemplate ref={ticketRef} sale={lastSale} client={selectedClient} />
      </div>
    </div>
  );
}
