'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Truck, Package, Plus, Scale, ArrowRight, Trash2, Users } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CascadeProductSelect } from '@/components/ui/cascade-product-select';
import { useProducts } from '@/hooks/use-products-supabase';
import { useIngresos, useCreateIngreso, type IngresoLote, type IngresoItemCreate } from '@/hooks/use-ingresos-supabase';

interface IngresoItemForm {
  id: string; // Unique ID for React key
  supplier_name: string;
  product_name: string | null;   // Paso 1
  product_type: string | null;   // Paso 2
  product_id: number | null;     // Paso 3 (Calidad)
  
  // Cantidad inputs
  quantity_mode: 'JAVA' | 'KG';
  quantity_input: string; // The value typed by user
  
  // Legacy fields kept for compatibility or calculation
  total_kg: string; 
  
  conversion_factor: string;
  cost_price_input: string;
  cost_price_mode: 'KG' | 'JAVA';
}

const createEmptyItem = (): IngresoItemForm => ({
  id: crypto.randomUUID(),
  supplier_name: '',
  product_name: null,
  product_type: null,
  product_id: null,
  
  quantity_mode: 'JAVA', // Default preference
  quantity_input: '',
  total_kg: '', // Will be calculated
  
  conversion_factor: '20',
  cost_price_input: '',
  cost_price_mode: 'KG', // Original default
});

export default function IngresosPage() {
  const { toast } = useToast();
  
  // React Query hooks
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: ingresos = [], isLoading: ingresosLoading } = useIngresos();
  const createIngreso = useCreateIngreso();
  
  // Form state
  const [truckId, setTruckId] = useState('');
  const [items, setItems] = useState<IngresoItemForm[]>([createEmptyItem()]);

  // Calculate totals
  const calculateItemValues = useCallback((item: IngresoItemForm) => {
    const conversionFactor = parseFloat(item.conversion_factor) || 20;
    const inputValue = parseFloat(item.quantity_input) || 0;
    
    // Calculate quantities based on mode
    let totalJavas = 0;
    let totalKg = 0;

    if (item.quantity_mode === 'JAVA') {
        totalJavas = inputValue;
        totalKg = inputValue * conversionFactor;
    } else {
        totalKg = inputValue; // User typed KG
        totalJavas = totalKg / conversionFactor;
    }
    
    // Calculate costs
    const costInput = parseFloat(item.cost_price_input) || 0;
    const costPerJava = item.cost_price_mode === 'KG' 
      ? costInput * conversionFactor 
      : costInput;
    const costPerKg = item.cost_price_mode === 'JAVA' 
      ? costInput / conversionFactor 
      : costInput;
      
    // Total cost depends on total javas
    const totalCost = costPerJava * totalJavas;
    
    return { 
        totalJavas, 
        totalKg, // Return calculated Kgs
        costPerJava, 
        costPerKg, 
        totalCost 
    };
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const values = calculateItemValues(item);
        return {
          kg: acc.kg + values.totalKg,
          javas: acc.javas + values.totalJavas,
          cost: acc.cost + values.totalCost,
        };
      },
      { kg: 0, javas: 0, cost: 0 }
    );
  }, [items, calculateItemValues]);

  // Update product conversion factor
  const handleProductChange = (index: number, productId: number | null) => {
    const product = products.find((p: { id: number }) => p.id === productId);
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        product_id: productId,
        conversion_factor: product?.conversion_factor?.toString() || '20',
      };
      return updated;
    });
  };

  const updateItem = (index: number, field: keyof IngresoItemForm, value: string | number | null) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const resetForm = () => {
    setTruckId('');
    setItems([createEmptyItem()]);
  };

  const validateForm = (): string | null => {
    if (!truckId.trim()) {
      return 'Ingresa la placa del camión';
    }
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.supplier_name.trim()) {
        return `Item ${i + 1}: Ingresa el nombre del proveedor`;
      }
      if (!item.product_id) {
        return `Item ${i + 1}: Selecciona un producto`;
      }
      if (!item.quantity_input || parseFloat(item.quantity_input) <= 0) {
        return `Item ${i + 1}: Ingresa la cantidad (${item.quantity_mode === 'JAVA' ? 'Javas' : 'KG'})`;
      }
      if (!item.cost_price_input || parseFloat(item.cost_price_input) <= 0) {
        return `Item ${i + 1}: Ingresa el precio de costo`;
      }
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateForm();
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
      return;
    }

    const ingresoItems: IngresoItemCreate[] = items.map(item => {
      const values = calculateItemValues(item);
      return {
        supplier_name: item.supplier_name.trim(),
        product_id: item.product_id!,
        total_kg: values.totalKg, // Calculated KG
        quantity_javas: values.totalJavas, // Calculated Javas
        conversion_factor: parseFloat(item.conversion_factor),
        cost_price_input: parseFloat(item.cost_price_input),
        cost_price_mode: item.cost_price_mode,
      };
    }); try {
      await createIngreso.mutateAsync({
        truck_plate: truckId.trim(),
        items: ingresoItems,
      });

      toast({
        title: 'Éxito',
        description: `Ingreso registrado: ${items.length} item(s) para camión ${truckId}`,
      });

      resetForm();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al registrar ingreso',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return 'Fecha inválida';
      return format(date, 'dd MMM yyyy', { locale: es });
    } catch {
      return 'Fecha inválida';
    }
  };

  const getProductName = (productId: number): string => {
    const product = products.find((p: { id: number; name: string; quality: string }) => p.id === productId);
    return product ? `${product.name} (${product.quality})` : `Producto #${productId}`;
  };

  // Stock map (empty for product select - no stock filtering needed in ingresos)
  const stockMap: Record<number, number> = {};

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Truck className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Ingreso de Mercadería</h1>
          <p className="text-sm md:text-base text-gray-500">
            Registra la llegada de productos de múltiples proveedores
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        {/* Form */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Plus className="h-5 w-5" />
              Nuevo Ingreso
            </CardTitle>
            <CardDescription>
              Puedes agregar múltiples proveedores para un mismo camión
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Truck ID */}
              <div className="space-y-2">
                <Label htmlFor="truckId" className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Placa del Camión
                </Label>
                <Input
                  id="truckId"
                  value={truckId}
                  onChange={(e) => setTruckId(e.target.value.toUpperCase())}
                  placeholder="ABC-123"
                  className="font-mono"
                  required
                />
              </div>

              {/* Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-base font-medium">
                    <Users className="h-4 w-4" />
                    Proveedores ({items.length})
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Proveedor
                  </Button>
                </div>

                {items.map((item, index) => {
                  const values = calculateItemValues(item);
                  
                  return (
                    <div
                      key={item.id}
                      className="p-4 border rounded-lg space-y-4 bg-gray-50/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">
                          Proveedor {index + 1}
                        </span>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Nombre del Proveedor</Label>
                          <Input
                            value={item.supplier_name}
                            onChange={(e) => updateItem(index, 'supplier_name', e.target.value)}
                            placeholder="Nombre del proveedor"
                            required
                          />
                        </div>
                        
                        {/* 🆕 PRODUCT SELECTION (Cascading) - Full Width */}
                        <div className="col-span-1 sm:col-span-2">
                          <CascadeProductSelect
                            products={products}
                            selectedProductId={item.product_id}
                            onSelect={(id) => handleProductChange(index, id)}
                            disabled={productsLoading || createIngreso.isPending}
                            // No stock needed in Ingresos, or pass 0 if we want to show "Stock: 0.00 javas" inside
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Removed Legacy Total KG Input */}
                        <div className="space-y-4 sm:col-span-2">
                           {/* Quantity Mode Selector & Input */}
                           <div className="space-y-2">
                            <Label className="text-sm font-medium">Cantidad</Label>
                            <div className="flex gap-2">
                                <Button
                                type="button"
                                variant={item.quantity_mode === 'JAVA' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => updateItem(index, 'quantity_mode', 'JAVA')}
                                className="flex-1"
                                >
                                Por Javas
                                </Button>
                                <Button
                                type="button"
                                variant={item.quantity_mode === 'KG' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => updateItem(index, 'quantity_mode', 'KG')}
                                className="flex-1"
                                >
                                Por KG
                                </Button>
                            </div>
                            <div className="relative">
                                <Input
                                type="number"
                                step="any"
                                min="0.01"
                                value={item.quantity_input}
                                onChange={(e) => updateItem(index, 'quantity_input', e.target.value)}
                                placeholder={item.quantity_mode === 'JAVA' ? 'Nº Javas' : 'Total KG'}
                                required
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-gray-500 font-medium">
                                    {item.quantity_mode === 'JAVA' ? 'JAVAS' : 'KG'}
                                </span>
                            </div>
                           </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Factor (KG/Java)</Label>
                          <Input
                            type="number"
                            step="any"
                            min="0.1"
                            value={item.conversion_factor}
                            onChange={(e) => updateItem(index, 'conversion_factor', e.target.value)}
                            placeholder="20"
                            required
                          />
                        </div>
                      </div>

                      {/* Calculated Display */}
                      <div className="p-3 bg-blue-50 rounded-lg flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4 text-blue-600" />
                            <p className="text-sm text-blue-700 font-medium">
                            Conversión Automática:
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pl-6 text-sm">
                            <div className={item.quantity_mode === 'JAVA' ? 'font-bold text-blue-900' : 'text-gray-600'}>
                                {values.totalJavas.toFixed(2)} Javas
                            </div>
                            <div className={item.quantity_mode === 'KG' ? 'font-bold text-blue-900' : 'text-gray-600'}>
                                {values.totalKg.toFixed(2)} KG
                            </div>
                        </div>
                      </div>

                      {/* Cost price */}
                      <div className="space-y-3 p-3 border rounded-lg bg-white">
                        <Label className="text-sm font-medium">Precio de Costo</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={item.cost_price_mode === 'JAVA' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateItem(index, 'cost_price_mode', 'JAVA')}
                            className="flex-1"
                          >
                            Por Java
                          </Button>
                          <Button
                            type="button"
                            variant={item.cost_price_mode === 'KG' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateItem(index, 'cost_price_mode', 'KG')}
                            className="flex-1"
                          >
                            Por KG
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">
                            S/. por {item.cost_price_mode === 'JAVA' ? 'Java' : 'KG'}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.cost_price_input}
                            onChange={(e) => updateItem(index, 'cost_price_input', e.target.value)}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        {item.cost_price_input && parseFloat(item.cost_price_input) > 0 && (
                          <div className="p-2 bg-gray-50 rounded text-sm space-y-1">
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>S/. {values.costPerKg.toFixed(2)}/kg</span>
                              <ArrowRight className="h-3 w-3" />
                              <span>S/. {values.costPerJava.toFixed(2)}/java</span>
                            </div>
                            {item.total_kg && (
                              <p className="font-medium text-primary">
                                Subtotal: S/. {values.totalCost.toFixed(2)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              {items.some(item => item.total_kg && parseFloat(item.total_kg) > 0) && (
                <div className="p-4 bg-primary/10 rounded-lg space-y-2">
                  <h3 className="font-medium">Resumen del Lote</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Total KG</p>
                      <p className="font-bold text-lg">{totals.kg.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Javas</p>
                      <p className="font-bold text-lg">{totals.javas.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Costo Total</p>
                      <p className="font-bold text-lg text-primary">S/. {totals.cost.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={createIngreso.isPending}
              >
                {createIngreso.isPending ? 'Registrando...' : 'Registrar Ingreso'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Ingresos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Lotes Recientes
            </CardTitle>
            <CardDescription>Últimos ingresos por camión</CardDescription>
          </CardHeader>
          <CardContent>
            {ingresosLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Cargando...</p>
              </div>
            ) : ingresos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay ingresos registrados</p>
            ) : (
              <div className="space-y-4">
                {(ingresos as IngresoLote[]).slice(0, 10).map((lote) => (
                  <div key={lote.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Camión: {lote.truck_plate}
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(lote.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          {Number(lote.total_javas || 0).toFixed(2)} javas
                        </p>
                        <p className="text-sm text-gray-500">
                          {Number(lote.total_kg || 0).toFixed(2)} kg
                        </p>
                      </div>
                    </div>
                    
                    {/* Items */}
                    <div className="space-y-2 pt-3 border-t">
                      {lote.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium">{item.supplier_name}</span>
                            <span className="text-gray-500"> - {item.product_name || getProductName(item.product_id)}</span>
                          </div>
                          <div className="text-right">
                            <span>{Number(item.quantity_javas).toFixed(1)} j</span>
                            <span className="text-gray-500 ml-2">
                              S/. {Number(item.cost_per_java).toFixed(2)}/j
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {lote.total_cost && (
                      <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                        <span className="text-gray-500">Costo Total:</span>
                        <span className="font-medium">S/. {Number(lote.total_cost).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
