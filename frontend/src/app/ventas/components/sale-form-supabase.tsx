'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientSelect } from '@/components/ui/searchable-select';
import { Plus, Trash2, Printer, Save, Scale, UserPlus, AlertTriangle, User } from 'lucide-react';
import { TicketTemplate } from './ticket-template';
import { useReactToPrint } from 'react-to-print';

// ✅ SUPABASE HOOKS (Adiós mock data)
import { useProducts, useProductTypes } from '@/hooks/use-products-supabase';
import { useClients, useCreateClient } from '@/hooks/use-clients-supabase';
import { useStock } from '@/hooks/use-stock-supabase';
import { useCreateVenta } from '@/hooks/use-ventas-supabase';
import { useAuthStore } from '@/store/auth-store';

interface SaleItem {
  id: string;
  product_name: string | null;   // Paso 1: Nombre del producto (Kion, Manzana, etc.)
  product_type: string | null;   // Paso 2: Tipo específico dentro del nombre
  product_id: number | null;     // Paso 3: Producto específico (con calidad)
  quantity_kg: string;
  price_per_kg: string;
  hasStockWarning: boolean;      // ⚠️ Stock insuficiente
}

const createEmptyItem = (): SaleItem => ({
  id: crypto.randomUUID(),
  product_name: null,
  product_type: null,
  product_id: null,
  quantity_kg: '',
  price_per_kg: '',
  hasStockWarning: false,
});

/**
 * Parse a numeric string, removing leading zeros except for decimals.
 */
const parseNumericInput = (value: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/^0+(?=\d)/, '');
  if (value === '0' || cleaned === '') return value === '0' ? '0' : '';
  return cleaned;
};

export function SaleFormSupabase({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  
  // ✅ React Query hooks conectados a Supabase
  const { data: products = [] } = useProducts();
  const { data: productTypes = [] } = useProductTypes();
  const { data: clients = [], refetch: refetchClients } = useClients();
  const { data: stock } = useStock();
  const createVenta = useCreateVenta();
  const createClientMutation = useCreateClient();
  
  // Form state
  const [mode, setMode] = useState<'CAJA' | 'PEDIDO'>('CAJA');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [guestClientName, setGuestClientName] = useState('');  // 🆕 Cliente eventual
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'YAPE'>('EFECTIVO');
  const [amortization, setAmortization] = useState('');
  const [items, setItems] = useState<SaleItem[]>([createEmptyItem()]);
  const [lastSale, setLastSale] = useState<any>(null);
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [shouldPrintAfterSave, setShouldPrintAfterSave] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');
  
  const ticketRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: ticketRef });

  // Create stock map for quick lookup
  const stockMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (stock) {
      stock.forEach((s) => {
        map[s.product_id] = s.stock_javas;
      });
    }
    return map;
  }, [stock]);

  // Get unique product NAMES (Kion, Manzana, etc. - from name field)
  const uniqueProductNames = useMemo(() => {
    const names = new Set(products.map(p => p.name));
    return Array.from(names).sort();
  }, [products]);

  // Get unique TYPES for a given product name (Chino, Fuji, etc.)
  const getTypesForProductName = useCallback((productName: string | null) => {
    if (!productName) return [];
    const productsWithName = products.filter(p => p.name === productName);
    const types = new Set(productsWithName.map(p => p.type));
    return Array.from(types).sort();
  }, [products]);

  // Get products filtered by name and type (for cascade step 3 - qualities)
  const getProductsByNameAndType = useCallback((productName: string | null, productType: string | null) => {
    if (!productName) return [];
    if (!productType) return products.filter(p => p.name === productName);
    return products.filter(p => p.name === productName && p.type === productType);
  }, [products]);

  const selectedClient = useMemo(() => 
    clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const getProductById = (productId: number | null) => {
    if (!productId) return undefined;
    return products.find((p) => p.id === productId);
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
    const conversionFactor = product?.conversion_factor || 17;  // Default 17 kg/java
    
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

  // Check for stock warnings
  const hasAnyStockWarning = useMemo(() => 
    items.some(item => item.hasStockWarning),
    [items]
  );

  const addItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, updates: Partial<SaleItem>) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  // 🔄 Handle cascade: when product NAME changes (first step)
  const handleProductNameChange = (index: number, name: string | null) => {
    const typesForName = getTypesForProductName(name);
    const productsWithName = products.filter(p => p.name === name);
    
    // Si solo hay un producto con ese nombre, seleccionarlo automáticamente
    if (productsWithName.length === 1) {
      updateItem(index, { 
        product_name: name, 
        product_type: productsWithName[0].type,
        product_id: productsWithName[0].id,
        hasStockWarning: false,
      });
    } else if (typesForName.length === 1) {
      // Si solo hay un tipo, seleccionarlo y verificar calidades
      const productsOfType = products.filter(p => p.name === name && p.type === typesForName[0]);
      if (productsOfType.length === 1) {
        updateItem(index, { 
          product_name: name, 
          product_type: typesForName[0],
          product_id: productsOfType[0].id,
          hasStockWarning: false,
        });
      } else {
        updateItem(index, { 
          product_name: name, 
          product_type: typesForName[0],
          product_id: null,
          hasStockWarning: false,
        });
      }
    } else {
      updateItem(index, { 
        product_name: name, 
        product_type: null,
        product_id: null,
        hasStockWarning: false,
      });
    }
  };

  // 🔄 Handle cascade: when product TYPE changes (second step)
  const handleTypeChange = (index: number, type: string | null) => {
    const item = items[index];
    const productsOfType = products.filter(p => p.name === item.product_name && p.type === type);
    
    // Si solo hay un producto de este tipo, seleccionarlo automáticamente
    if (productsOfType.length === 1) {
      updateItem(index, { 
        product_type: type, 
        product_id: productsOfType[0].id,
        hasStockWarning: false,
      });
    } else {
      updateItem(index, { 
        product_type: type, 
        product_id: null,
        hasStockWarning: false,
      });
    }
  };

  // 🆕 Handle product selection and check stock
  const handleProductChange = (index: number, productId: number | null) => {
    updateItem(index, { product_id: productId, hasStockWarning: false });
  };

  // Handle numeric input with proper formatting
  const handleNumericInput = (index: number, field: 'quantity_kg' | 'price_per_kg', value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const cleaned = parseNumericInput(value);
      updateItem(index, { [field]: cleaned });
      
      // 🆕 Check stock when quantity changes
      if (field === 'quantity_kg') {
        const item = items[index];
        if (item.product_id && cleaned) {
          const product = getProductById(item.product_id);
          const conversionFactor = product?.conversion_factor || 17;  // Default 17 kg/java
          const quantityJavas = parseFloat(cleaned) / conversionFactor;
          const stockAvailable = getStockForProduct(item.product_id);
          
          // Si cantidad > stock, mostrar warning pero NO bloquear
          if (quantityJavas > stockAvailable) {
            updateItem(index, { 
              [field]: cleaned, 
              hasStockWarning: true 
            });
            toast({
              variant: 'default',
              title: '⚠️ Stock Insuficiente',
              description: `Disponible: ${stockAvailable.toFixed(2)} javas. Se registrará en negativo.`,
              className: 'bg-yellow-50 border-yellow-200',
            });
          } else {
            updateItem(index, { [field]: cleaned, hasStockWarning: false });
          }
        }
      }
    }
  };

  const resetForm = () => {
    setSelectedClientId(null);
    setGuestClientName('');
    setAmortization('');
    setItems([createEmptyItem()]);
    setLastSale(null);
    setShouldPrintAfterSave(false);
  };

  // 🆕 Validation without stock blocking
  const validateSale = (): string | null => {
    // En modo PEDIDO, cliente obligatorio
    if (mode === 'PEDIDO' && !selectedClientId) {
      return 'Selecciona un cliente para el pedido';
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
      
      // ❌ ELIMINADO: Bloqueo por stock insuficiente
      // Ahora solo se muestra warning, no se bloquea
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

  // ✅ Submit using Supabase RPC
  const handleConfirmedSubmit = async () => {
    setShowConfirmModal(false);
    
    if (!user?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Usuario no autenticado' });
      return;
    }

    const ventaItems = items.map(item => ({
      product_id: item.product_id!,
      quantity_kg: parseFloat(item.quantity_kg),
      price_per_kg: parseFloat(item.price_per_kg),
    }));

    try {
      const result = await createVenta.mutateAsync({
        type: mode,
        client_id: mode === 'PEDIDO' ? selectedClientId : null,
        guest_client_name: mode === 'CAJA' ? (guestClientName.trim() || null) : null,
        user_id: user.id,
        payment_method: mode === 'CAJA' ? paymentMethod : 'CREDITO',
        amortization: mode === 'PEDIDO' ? (parseFloat(amortization) || 0) : 0,
        items: ventaItems,
      });

      setLastSale(result);
      
      toast({
        title: '✅ Venta Exitosa',
        description: `Venta #${result.venta_id} registrada. Total: S/ ${result.total_amount?.toFixed(2)}`,
      });

      if (shouldPrintAfterSave) {
        setTimeout(() => handlePrint(), 500);
      }

      onSuccess();
      resetForm();
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Error al guardar', 
        description: error.message 
      });
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
      
      toast({ title: '✅ Éxito', description: `Cliente "${newClientName}" creado` });
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
          <TabsTrigger value="CAJA" className="text-xs md:text-sm">💵 Caja (Contado)</TabsTrigger>
          <TabsTrigger value="PEDIDO" className="text-xs md:text-sm">📋 Pedido (Crédito)</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <span className="text-lg md:text-xl">Nueva Venta - {mode}</span>
              {mode === 'PEDIDO' && selectedClient && (
                <Badge variant="destructive" className="text-sm md:text-lg px-3 py-1 w-fit">
                  Deuda: S/ {Number(selectedClient.current_debt).toFixed(2)}
                </Badge>
              )}
              {hasAnyStockWarning && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Stock Insuficiente
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
            {/* ===== SECCIÓN CLIENTE ===== */}
            {mode === 'PEDIDO' ? (
              // PEDIDO: Cliente obligatorio
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Cliente *</Label>
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
                  clients={clients.map(c => ({
                    ...c,
                    whatsapp_number: c.whatsapp_number ?? undefined
                  }))}
                  value={selectedClientId}
                  onSelect={setSelectedClientId}
                  disabled={createVenta.isPending}
                />
              </div>
            ) : (
              // 🆕 CAJA: Cliente OPCIONAL + Método de pago
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Cliente Eventual (Opcional)
                  </Label>
                  <Input
                    value={guestClientName}
                    onChange={(e) => setGuestClientName(e.target.value)}
                    placeholder="Nombre del cliente (para el ticket)"
                    disabled={createVenta.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Método de Pago</Label>
                  <Select 
                    value={paymentMethod} 
                    onValueChange={(v) => setPaymentMethod(v as 'EFECTIVO' | 'YAPE')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EFECTIVO">💵 Efectivo</SelectItem>
                      <SelectItem value="YAPE">📱 Yape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Amortización (solo PEDIDO) */}
            {mode === 'PEDIDO' && selectedClient && (
              <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                <Label>Pago a cuenta (Amortización)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amortization}
                  onChange={(e) => {
                    if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                      setAmortization(e.target.value);
                    }
                  }}
                  placeholder="0.00"
                  disabled={createVenta.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Si el cliente paga algo ahora, ingresa el monto aquí.
                </p>
              </div>
            )}

            {/* ===== PRODUCTOS CON SELECTOR EN CASCADA ===== */}
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
                
                // Obtener tipos disponibles para el nombre seleccionado
                // Obtener tipos disponibles para el nombre seleccionado
                const typesForName = getTypesForProductName(item.product_name);
                const hasMultipleTypes = typesForName.length > 1;
                
                // Obtener productos disponibles para nombre+tipo seleccionado
                const productsOfNameAndType = getProductsByNameAndType(item.product_name, item.product_type);
                const hasMultipleQualities = productsOfNameAndType.length > 1;
                
                return (
                  <div 
                    key={item.id} 
                    className={`flex flex-col gap-3 border rounded-lg p-4 ${
                      item.hasStockWarning 
                        ? 'bg-yellow-50/50 border-yellow-300' 
                        : 'bg-gray-50/50'
                    }`}
                  >
                    {/* 🆕 SELECTOR EN CASCADA: Nombre > Tipo > Calidad */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Paso 1: Nombre del Producto (Kion, Manzana, etc.) */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Nombre</Label>
                        <Select
                          value={item.product_name || ''}
                          onValueChange={(v) => handleProductNameChange(index, v || null)}
                          disabled={createVenta.isPending}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueProductNames.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Paso 2: Tipo (Chino, Fuji, etc. - solo si hay más de uno) */}
                      {item.product_name && hasMultipleTypes && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Tipo</Label>
                          <Select
                            value={item.product_type || ''}
                            onValueChange={(v) => handleTypeChange(index, v || null)}
                            disabled={createVenta.isPending}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                              {typesForName.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Paso 3: Calidad (Primera, Segunda, etc. - solo si hay más de una) */}
                      {item.product_name && item.product_type && hasMultipleQualities && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Calidad</Label>
                          <Select
                            value={item.product_id?.toString() || ''}
                            onValueChange={(v) => handleProductChange(index, v ? parseInt(v) : null)}
                            disabled={createVenta.isPending}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar calidad..." />
                            </SelectTrigger>
                            <SelectContent>
                              {productsOfNameAndType.map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                  {p.quality} - Stock: {(stockMap[p.id] || 0).toFixed(2)} javas
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Producto seleccionado (nombre completo): Nombre - Tipo (Calidad) */}
                    {item.product_id && (
                      <div className="bg-blue-50 rounded px-3 py-2">
                        <span className="text-sm font-medium text-blue-700">
                          📦 {getProductById(item.product_id)?.name}
                          {getProductById(item.product_id)?.type && (
                            <span className="text-blue-600"> - {getProductById(item.product_id)?.type}</span>
                          )}
                          {getProductById(item.product_id)?.quality && getProductById(item.product_id)?.quality !== 'Sin Clasificar' && (
                            <span className="text-blue-500"> ({getProductById(item.product_id)?.quality})</span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Stock info */}
                    {item.product_id && (
                      <p className={`text-xs ${item.hasStockWarning ? 'text-yellow-700 font-medium' : 'text-muted-foreground'}`}>
                        {item.hasStockWarning && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                        Stock: {stockAvailable.toFixed(2)} javas ({stockKg.toFixed(1)} kg)
                      </p>
                    )}
                    
                    {/* Cantidad, Precio, Subtotal */}
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
                          className={item.hasStockWarning ? 'border-yellow-400' : ''}
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
          
          {/* ===== FOOTER CON TOTALES ===== */}
          <CardFooter className="flex flex-col items-end gap-4 bg-gray-50 p-6">
            <div className="text-right space-y-1 w-full md:w-auto">
              <p className="text-sm text-gray-500">
                Total: {totals.kg.toFixed(2)} kg ({totals.javas.toFixed(2)} javas)
              </p>
              <p className="text-sm text-gray-500">Subtotal: S/ {totals.amount.toFixed(2)}</p>
              
              {mode === 'PEDIDO' && selectedClient && (
                <>
                  <p className="text-sm text-gray-500">
                    Deuda Anterior: S/ {Number(selectedClient.current_debt).toFixed(2)}
                  </p>
                  {parseFloat(amortization) > 0 && (
                    <p className="text-sm text-green-600">
                      Amortización: - S/ {parseFloat(amortization).toFixed(2)}
                    </p>
                  )}
                  <p className="text-xl font-bold text-primary">
                    Nueva Deuda: S/ {Math.max(0, (totals.amount + Number(selectedClient.current_debt)) - (parseFloat(amortization) || 0)).toFixed(2)}
                  </p>
                </>
              )}
              {mode === 'CAJA' && (
                <p className="text-xl font-bold text-primary">
                  Total a Pagar: S/ {totals.amount.toFixed(2)}
                </p>
              )}
            </div>
            
            {/* Warning banner if stock issues */}
            {hasAnyStockWarning && (
              <div className="w-full p-3 bg-yellow-100 border border-yellow-300 rounded-lg flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">
                  Algunos productos tienen stock insuficiente. Se registrarán en negativo.
                </span>
              </div>
            )}
            
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

      {/* ===== MODAL DE CONFIRMACIÓN ===== */}
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
            
            {mode === 'CAJA' && guestClientName && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">Cliente: {guestClientName}</p>
                <p className="text-sm text-gray-600">Pago: {paymentMethod}</p>
              </div>
            )}

            {hasAnyStockWarning && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="text-yellow-800">
                  Esta venta incluye productos con stock insuficiente que se registrarán en negativo.
                </span>
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
                    <TableRow key={item.id} className={item.hasStockWarning ? 'bg-yellow-50' : ''}>
                      <TableCell>
                        {product?.name || 'Producto'} - {product?.quality}
                        {item.hasStockWarning && (
                          <AlertTriangle className="h-3 w-3 inline ml-1 text-yellow-600" />
                        )}
                      </TableCell>
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
                    <span>S/ {Number(selectedClient.current_debt).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Venta Actual:</span>
                    <span>S/ {totals.amount.toFixed(2)}</span>
                  </div>
                  {parseFloat(amortization) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>- Amortización:</span>
                      <span>S/ {parseFloat(amortization).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Nueva Deuda Total:</span>
                    <span className="text-red-600">
                      S/ {Math.max(0, (totals.amount + Number(selectedClient.current_debt)) - (parseFloat(amortization) || 0)).toFixed(2)}
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

      {/* ===== MODAL NUEVO CLIENTE ===== */}
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
