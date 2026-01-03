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
import { ProductSelect } from '@/components/ui/searchable-select';
import { useProducts } from '@/hooks/use-products';
import { useIngresos, useCreateIngreso } from '@/hooks/use-ingresos';
import type { IngresoItemCreate, IngresoLote } from '@/lib/api';

interface IngresoItemForm {
  id: string; // Unique ID for React key
  supplier_name: string;
  product_id: number | null;
  total_kg: string;
  conversion_factor: string;
  cost_price_input: string;
  cost_price_mode: 'KG' | 'JAVA';
}

const createEmptyItem = (): IngresoItemForm => ({
  id: crypto.randomUUID(),
  supplier_name: '',
  product_id: null,
  total_kg: '',
  conversion_factor: '20',
  cost_price_input: '',
  cost_price_mode: 'JAVA',
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
    const totalKg = parseFloat(item.total_kg) || 0;
    const conversionFactor = parseFloat(item.conversion_factor) || 20;
    const costInput = parseFloat(item.cost_price_input) || 0;
    
    const totalJavas = totalKg / conversionFactor;
    const costPerJava = item.cost_price_mode === 'KG' 
      ? costInput * conversionFactor 
      : costInput;
    const costPerKg = item.cost_price_mode === 'JAVA' 
      ? costInput / conversionFactor 
      : costInput;
    const totalCost = costPerJava * totalJavas;
    
    return { totalJavas, costPerJava, costPerKg, totalCost };
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const values = calculateItemValues(item);
        return {
          kg: acc.kg + (parseFloat(item.total_kg) || 0),
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
      if (!item.total_kg || parseFloat(item.total_kg) <= 0) {
        return `Item ${i + 1}: Ingresa los KG totales`;
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

    const ingresoItems: IngresoItemCreate[] = items.map(item => ({
      supplier_name: item.supplier_name.trim(),
      product_id: item.product_id!,
      total_kg: parseFloat(item.total_kg),
      conversion_factor: parseFloat(item.conversion_factor),
      cost_price_input: parseFloat(item.cost_price_input),
      cost_price_mode: item.cost_price_mode,
    }));

    try {
      await createIngreso.mutateAsync({
        truck_id: truckId.trim(),
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
                        <div className="space-y-2">
                          <Label>Nombre del Proveedor</Label>
                          <Input
                            value={item.supplier_name}
                            onChange={(e) => updateItem(index, 'supplier_name', e.target.value)}
                            placeholder="Nombre del proveedor"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Producto</Label>
                          <ProductSelect
                            products={products}
                            stockMap={stockMap}
                            value={item.product_id}
                            onSelect={(id) => handleProductChange(index, id)}
                            disabled={productsLoading || createIngreso.isPending}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Total KG</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.total_kg}
                            onChange={(e) => updateItem(index, 'total_kg', e.target.value)}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Factor (KG/Java)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="1"
                            value={item.conversion_factor}
                            onChange={(e) => updateItem(index, 'conversion_factor', e.target.value)}
                            placeholder="20"
                            required
                          />
                        </div>
                      </div>

                      {/* Calculated javas */}
                      <div className="p-3 bg-blue-50 rounded-lg flex items-center gap-2">
                        <Scale className="h-4 w-4 text-blue-600" />
                        <p className="text-sm text-blue-700">
                          <strong>Javas:</strong> {values.totalJavas.toFixed(2)}
                        </p>
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
                          Camión: {lote.truck_id}
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(lote.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          {lote.total_javas?.toFixed(2) || '0'} javas
                        </p>
                        <p className="text-sm text-gray-500">
                          {lote.total_kg?.toFixed(2) || '0'} kg
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
                            <span>{item.total_javas.toFixed(1)} j</span>
                            <span className="text-gray-500 ml-2">
                              S/. {item.cost_per_java.toFixed(2)}/j
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {lote.total_cost && (
                      <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                        <span className="text-gray-500">Costo Total:</span>
                        <span className="font-medium">S/. {lote.total_cost.toFixed(2)}</span>
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
