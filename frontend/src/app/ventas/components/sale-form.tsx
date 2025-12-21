'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
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
import { Check, ChevronsUpDown, Plus, Trash2, Printer, Save, Scale, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TicketTemplate } from './ticket-template';
import { useReactToPrint } from 'react-to-print';

interface Product {
  id: number;
  name: string;
  type: string;
  quality: string;
  conversion_factor: number;
  stock_available?: number;
}

interface StockItem {
  product_id: number;
  product_name: string;
  total_javas_available: number;
}

interface Client {
  id: number;
  name: string;
  whatsapp_number: string;
  current_debt: string;
}

interface SaleItem {
  product_id: number;
  quantity: number;  // User-entered quantity (could be KG or Java)
  unit: 'JAVA' | 'KG';
  unit_sale_price: number;
}

export function SaleForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'CAJA' | 'PEDIDO'>('PEDIDO');
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [items, setItems] = useState<SaleItem[]>([{ product_id: 0, quantity: 1, unit: 'JAVA', unit_sale_price: 0 }]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [shouldPrintAfterSave, setShouldPrintAfterSave] = useState(false);
  
  // New client modal state
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  
  const { token } = useAuthStore();
  const { toast } = useToast();
  const ticketRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
  });

  useEffect(() => {
    fetchClients();
    fetchProducts();
    fetchStock();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/python/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setClients(await res.json());
    } catch (error) {}
  };

  const createNewClient = async () => {
    if (!newClientName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "El nombre es requerido" });
      return;
    }
    
    setIsCreatingClient(true);
    try {
      const res = await fetch('/api/python/clients', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: newClientName.trim(),
          whatsapp_number: newClientWhatsapp.trim() || null,
          current_debt: 0
        })
      });
      
      if (!res.ok) throw new Error('Error al crear cliente');
      
      const newClient = await res.json();
      
      // Refresh client list and select the new client
      await fetchClients();
      setSelectedClient(newClient);
      
      toast({ title: "Éxito", description: `Cliente "${newClientName}" creado` });
      setShowNewClientModal(false);
      setNewClientName('');
      setNewClientWhatsapp('');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsCreatingClient(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/python/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setProducts(await res.json());
    } catch (error) {}
  };

  const fetchStock = async () => {
    try {
      const res = await fetch('/api/python/ingresos/stock', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setStock(await res.json());
    } catch (error) {}
  };

  const getStockForProduct = (productId: number): number => {
    const stockItem = stock.find(s => s.product_id === productId);
    return stockItem ? stockItem.total_javas_available : 0;
  };

  const getProductById = (productId: number): Product | undefined => {
    return products.find(p => p.id === productId);
  };

  // Convert quantity to javas based on unit
  const getQuantityInJavas = (item: SaleItem): number => {
    if (item.unit === 'KG') {
      const product = getProductById(item.product_id);
      const conversionFactor = product?.conversion_factor || 20;
      return item.quantity / conversionFactor;
    }
    return item.quantity;
  };

  // Create stock map for ProductSelect component
  const stockMap: Record<number, number> = {};
  stock.forEach(s => {
    stockMap[s.product_id] = s.total_javas_available;
  });

  const addItem = () => {
    setItems([...items, { product_id: 0, quantity: 1, unit: 'JAVA', unit_sale_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof SaleItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateItemTotal = (item: SaleItem): number => {
    // El subtotal es simplemente cantidad * precio unitario
    // El precio ya está en la unidad seleccionada (por Java o por KG)
    return item.quantity * item.unit_sale_price;
  };

  const calculateSubtotal = () => {
    return items.reduce((acc, item) => acc + calculateItemTotal(item), 0);
  };

  // Validation before showing confirmation modal
  const validateSale = (): boolean => {
    if (mode === 'PEDIDO' && !selectedClient) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona un cliente" });
      return false;
    }

    if (items.some(item => item.product_id === 0 || item.unit_sale_price <= 0)) {
      toast({ variant: "destructive", title: "Error", description: "Completa todos los productos y precios" });
      return false;
    }

    // Validate stock available
    for (const item of items) {
      const availableStock = getStockForProduct(item.product_id);
      const quantityInJavas = getQuantityInJavas(item);
      if (quantityInJavas > availableStock) {
        const product = products.find(p => p.id === item.product_id);
        toast({ 
          variant: "destructive", 
          title: "Stock Insuficiente", 
          description: `${product?.name || 'Producto'}: Solo hay ${availableStock.toFixed(2)} javas disponibles, intentas vender ${quantityInJavas.toFixed(2)} javas` 
        });
        return false;
      }
    }

    return true;
  };

  // Show confirmation modal
  const handleShowConfirmation = (shouldPrint: boolean) => {
    if (!validateSale()) return;
    setShouldPrintAfterSave(shouldPrint);
    setShowConfirmModal(true);
  };

  // Actual submission
  const handleConfirmedSubmit = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    
    try {
      const saleData = {
        type: mode,
        client_id: mode === 'PEDIDO' ? selectedClient?.id : null,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity_javas: item.quantity,  // Original quantity entered
          unit_sale_price: item.unit_sale_price,
          unit: item.unit,
          quantity_original: item.quantity
        }))
      };

      const res = await fetch('/api/python/ventas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(saleData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Error al guardar la venta');
      }

      const savedSale = await res.json();
      setLastSale(savedSale);
      
      toast({
        title: "Venta Exitosa",
        description: mode === 'PEDIDO' ? "Pedido registrado correctamente" : "Venta registrada correctamente",
      });

      // Refresh stock after sale
      fetchStock();

      if (shouldPrintAfterSave) {
        // Trigger print after state update
        setTimeout(() => {
          handlePrint();
        }, 500);
      }

      onSuccess();
      resetForm();

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedClient(null);
    setItems([{ product_id: 0, quantity: 1, unit: 'JAVA', unit_sale_price: 0 }]);
    setLastSale(null);
    setShouldPrintAfterSave(false);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="PEDIDO" className="text-xs md:text-sm">Pedido (Crédito)</TabsTrigger>
          <TabsTrigger value="CAJA" className="text-xs md:text-sm">Caja (Contado)</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <span className="text-lg md:text-xl">Nueva Venta - {mode}</span>
              {mode === 'PEDIDO' && selectedClient && (
                <Badge variant="destructive" className="text-sm md:text-lg px-3 py-1 w-fit">
                  Deuda: S/ {parseFloat(selectedClient.current_debt).toFixed(2)}
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
                  value={selectedClient?.id || null}
                  onSelect={(clientId) => {
                    const client = clients.find(c => c.id === clientId);
                    setSelectedClient(client || null);
                  }}
                  disabled={isLoading}
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-base md:text-lg font-semibold">Productos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Agregar</span>
                </Button>
              </div>

              {items.map((item, index) => {
                const product = getProductById(item.product_id);
                const quantityInJavas = getQuantityInJavas(item);
                const stockAvailable = getStockForProduct(item.product_id);
                
                return (
                  <div key={index} className="flex flex-col gap-3 border-b pb-4">
                    <div className="flex-1 space-y-2">
                      <Label className="text-sm">Producto</Label>
                      <ProductSelect
                        products={products}
                        stockMap={stockMap}
                        value={item.product_id || null}
                        onSelect={(productId) => updateItem(index, 'product_id', productId || 0)}
                        disabled={isLoading}
                      />
                      {item.product_id > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Stock: {stockAvailable.toFixed(2)} javas
                          {item.unit === 'KG' && product && (
                            <span className="ml-2">
                              | Conversión: {product.conversion_factor} kg = 1 java
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="w-24 space-y-2">
                        <Label className="text-sm">Unidad</Label>
                        <Select 
                          value={item.unit} 
                          onValueChange={(v) => updateItem(index, 'unit', v as 'JAVA' | 'KG')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="JAVA">Javas</SelectItem>
                            <SelectItem value="KG">KG</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24 space-y-2">
                        <Label className="text-sm">
                          {item.unit === 'JAVA' ? 'Javas' : 'Kilos'}
                        </Label>
                        <Input 
                          type="number"
                          step="0.1"
                          min="0"
                          value={item.quantity} 
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="w-28 space-y-2">
                        <Label className="text-sm">Precio/{item.unit === 'JAVA' ? 'Java' : 'KG'}</Label>
                        <Input 
                          type="number" 
                          step="0.1"
                          min="0"
                          value={item.unit_sale_price} 
                          onChange={(e) => updateItem(index, 'unit_sale_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="flex-1 min-w-[100px] space-y-2">
                        <Label className="text-sm text-muted-foreground">Subtotal</Label>
                        <div className="h-10 flex items-center font-medium">
                          S/ {calculateItemTotal(item).toFixed(2)}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {item.unit === 'KG' && item.product_id > 0 && item.quantity > 0 && (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <Scale className="h-3 w-3" />
                        {item.quantity} kg = {quantityInJavas.toFixed(2)} javas
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-end gap-4 bg-gray-50 p-6">
            <div className="text-right space-y-1 w-full md:w-auto">
              <p className="text-sm text-gray-500">Subtotal Venta: S/ {calculateSubtotal().toFixed(2)}</p>
              {mode === 'PEDIDO' && selectedClient && (
                <>
                  <p className="text-sm text-gray-500">Deuda Anterior: S/ {parseFloat(selectedClient.current_debt).toFixed(2)}</p>
                  <p className="text-xl font-bold text-primary">
                    Nueva Deuda Total: S/ {(calculateSubtotal() + parseFloat(selectedClient.current_debt)).toFixed(2)}
                  </p>
                </>
              )}
              {mode === 'CAJA' && (
                <p className="text-xl font-bold text-primary">Total a Pagar: S/ {calculateSubtotal().toFixed(2)}</p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none px-6 py-6 text-base"
                onClick={() => handleShowConfirmation(false)} 
                disabled={isLoading}
              >
                <Save className="h-4 w-4 mr-2" />
                Solo Guardar
              </Button>
              <Button 
                className="flex-1 sm:flex-none px-6 py-6 text-base"
                onClick={() => handleShowConfirmation(true)} 
                disabled={isLoading}
              >
                <Printer className="h-4 w-4 mr-2" />
                {isLoading ? "Procesando..." : "Guardar e Imprimir"}
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
            <DialogDescription>
              Revisa los detalles antes de confirmar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {mode === 'PEDIDO' && selectedClient && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-medium">Cliente: {selectedClient.name}</p>
                <p className="text-sm text-gray-600">Tel: {selectedClient.whatsapp_number}</p>
              </div>
            )}
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const product = getProductById(item.product_id);
                  return (
                    <TableRow key={index}>
                      <TableCell>{product?.name || 'Producto'}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit === 'KG' ? 'kg' : 'javas'}
                        {item.unit === 'KG' && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({getQuantityInJavas(item).toFixed(2)} javas)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        S/ {item.unit_sale_price.toFixed(2)}/{item.unit === 'KG' ? 'kg' : 'java'}
                      </TableCell>
                      <TableCell className="text-right font-medium">S/ {calculateItemTotal(item).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Venta:</span>
                <span>S/ {calculateSubtotal().toFixed(2)}</span>
              </div>
              
              {mode === 'PEDIDO' && selectedClient && (
                <div className="bg-yellow-50 p-4 rounded-lg space-y-1">
                  <div className="flex justify-between">
                    <span>Deuda Anterior:</span>
                    <span>S/ {parseFloat(selectedClient.current_debt).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Venta Actual:</span>
                    <span>S/ {calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Nueva Deuda Total:</span>
                    <span className="text-red-600">
                      S/ {(calculateSubtotal() + parseFloat(selectedClient.current_debt)).toFixed(2)}
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
            <Button onClick={handleConfirmedSubmit} disabled={isLoading}>
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

      {/* Modal Nuevo Cliente */}
      <Dialog open={showNewClientModal} onOpenChange={setShowNewClientModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Crear un nuevo cliente rápidamente
            </DialogDescription>
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
              disabled={isCreatingClient || !newClientName.trim()}
            >
              {isCreatingClient ? 'Creando...' : 'Crear Cliente'}
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
