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
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem 
} from '@/components/ui/command';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus, Trash2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TicketTemplate } from './ticket-template';
import { useReactToPrint } from 'react-to-print';

interface Product {
  id: number;
  name: string;
  type: string;
  quality: string;
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
  quantity_javas: number;
  unit_sale_price: number;
}

export function SaleForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'CAJA' | 'PEDIDO'>('PEDIDO');
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [items, setItems] = useState<SaleItem[]>([{ product_id: 0, quantity_javas: 1, unit_sale_price: 0 }]);
  const [openClient, setOpenClient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  
  const { token } = useAuthStore();
  const { toast } = useToast();
  const ticketRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => ticketRef.current,
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

  const addItem = () => {
    setItems([...items, { product_id: 0, quantity_javas: 1, unit_sale_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof SaleItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((acc, item) => acc + (item.quantity_javas * item.unit_sale_price), 0);
  };

  const handleSubmit = async () => {
    if (mode === 'PEDIDO' && !selectedClient) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona un cliente" });
      return;
    }

    if (items.some(item => item.product_id === 0 || item.unit_sale_price <= 0)) {
      toast({ variant: "destructive", title: "Error", description: "Completa todos los productos y precios" });
      return;
    }

    // Validar stock disponible
    for (const item of items) {
      const availableStock = getStockForProduct(item.product_id);
      if (item.quantity_javas > availableStock) {
        const product = products.find(p => p.id === item.product_id);
        toast({ 
          variant: "destructive", 
          title: "Stock Insuficiente", 
          description: `${product?.name || 'Producto'}: Solo hay ${availableStock.toFixed(1)} javas disponibles, intentas vender ${item.quantity_javas}` 
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const saleData = {
        type: mode,
        client_id: mode === 'PEDIDO' ? selectedClient?.id : null,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity_javas: item.quantity_javas,
          unit_sale_price: item.unit_sale_price
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

      if (!res.ok) throw new Error('Error al guardar la venta');

      const savedSale = await res.json();
      setLastSale(savedSale);
      
      toast({
        title: "Venta Exitosa",
        description: mode === 'PEDIDO' ? "Ticket enviado a WhatsApp (Mock)" : "Venta registrada",
      });

      // Refrescar stock después de venta
      fetchStock();

      // Trigger print after state update
      setTimeout(() => {
        handlePrint();
        onSuccess();
        resetForm();
      }, 500);

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedClient(null);
    setItems([{ product_id: 0, quantity_javas: 1, unit_sale_price: 0 }]);
    setLastSale(null);
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
                <Label>Cliente</Label>
                <Popover open={openClient} onOpenChange={setOpenClient}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openClient}
                      className="w-full justify-between"
                    >
                      {selectedClient ? selectedClient.name : "Buscar cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Nombre del cliente..." />
                      <CommandEmpty>No se encontró el cliente.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            onSelect={() => {
                              setSelectedClient(client);
                              setOpenClient(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {client.name} - {client.whatsapp_number}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-base md:text-lg font-semibold">Productos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Agregar</span>
                </Button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-3 md:gap-4 md:items-end border-b pb-4">
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm">Producto</Label>
                    <Select 
                      value={item.product_id.toString()} 
                      onValueChange={(v) => updateItem(index, 'product_id', parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => {
                          const stockAvailable = getStockForProduct(p.id);
                          return (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name} ({p.quality}) - {stockAvailable.toFixed(1)} javas
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {item.product_id > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Stock disponible: {getStockForProduct(item.product_id).toFixed(1)} javas
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 md:gap-4">
                    <div className="flex-1 md:w-24 space-y-2">
                      <Label className="text-sm">Javas</Label>
                      <Input 
                        type="number" 
                        value={item.quantity_javas} 
                        onChange={(e) => updateItem(index, 'quantity_javas', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="flex-1 md:w-32 space-y-2">
                      <Label className="text-sm">Precio U.</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={item.unit_sale_price} 
                      onChange={(e) => updateItem(index, 'unit_sale_price', parseFloat(e.target.value))}
                    />
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
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-end gap-4 bg-gray-50 p-6">
            <div className="text-right space-y-1">
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
            <Button className="w-full md:w-auto px-12 py-6 text-lg" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Procesando..." : "Finalizar e Imprimir Ticket"}
            </Button>
          </CardFooter>
        </Card>
      </Tabs>

      {/* Hidden Ticket for Printing */}
      <div className="hidden">
        <TicketTemplate ref={ticketRef} sale={lastSale} client={selectedClient} />
      </div>
    </div>
  );
}
