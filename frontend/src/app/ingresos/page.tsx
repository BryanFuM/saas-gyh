'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Truck, Package, Plus, Scale, ArrowRight, Trash2, Users, Search, Edit, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
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
import { CascadeProductSelect } from '@/components/ui/cascade-product-select';
import { PosProductGrid } from '@/components/ui/pos-product-grid';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProducts } from '@/hooks/use-products-supabase';
import { useIngresos, useCreateIngreso, useDeleteIngreso, type IngresoLote, type IngresoItemCreate } from '@/hooks/use-ingresos-supabase';

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

// Helper component for managing Dialog state per row
function ProductSelectorDialog({ products, selectedProductId, onSelect, disabled }: any) {
    const [open, setOpen] = useState(false);
    
    // Find info for display
    const selectedProduct = products.find((p: any) => p.id === selectedProductId);
    const displayText = selectedProduct 
        ? `${selectedProduct.name} - ${selectedProduct.type} - ${selectedProduct.quality}`
        : "Seleccionar Producto...";

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    className={`w-full justify-between h-12 text-base ${!selectedProductId ? 'text-muted-foreground' : 'font-medium'}`}
                    disabled={disabled}
                >
                    {displayText}
                    <Package className="h-4 w-4 opacity-50" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Seleccionar Producto</DialogTitle>
                </DialogHeader>
                <PosProductGrid 
                    products={products}
                    selectedProductId={selectedProductId}
                    onSelect={(id) => {
                        onSelect(id);
                        setOpen(false);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

export default function IngresosPage() {
  const { toast } = useToast();
  
  // React Query hooks
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: ingresos = [], isLoading: ingresosLoading } = useIngresos();
  const createIngreso = useCreateIngreso();
  const deleteIngreso = useDeleteIngreso();
  
  // Form state
  const [truckId, setTruckId] = useState('');
  const [items, setItems] = useState<IngresoItemForm[]>([createEmptyItem()]);

  const handleDelete = async (id: number) => {
    if (!confirm('⚠️ PRECAUCIÓN: ELIMINAR INGRESO\n\nEsta acción:\n1. Eliminará el registro y sus items.\n2. RESTARÁ el stock ingresado del inventario.\n\n¿Estás seguro de continuar?')) return;
    
    try {
      await deleteIngreso.mutateAsync(id);
      toast({
        title: "Ingreso Eliminado",
        description: "El lote ha sido eliminado y el stock ha sido revertido correctamente.",
        variant: "default",
      });
    } catch (error) {
       console.error(error);
       toast({
        title: "Error al eliminar",
        description: "Hubo un problema al intentar eliminar el registro.",
        variant: "destructive",
      });
    }
  };

  // Filter & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter Logic
  const filteredIngresos = useMemo(() => {
    let result = ingresos || [];

    // Search filter
    if (searchTerm) {
       const lower = searchTerm.toLowerCase();
       result = result.filter((lote: IngresoLote) => 
          lote.truck_plate.toLowerCase().includes(lower) || 
          lote.items?.some(item => item.supplier_name.toLowerCase().includes(lower))
       );
    }

    // Date filter
    if (dateRange?.from) {
       const from = new Date(dateRange.from);
       from.setHours(0,0,0,0);
       
       const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
       to.setHours(23,59,59,999);

       result = result.filter((lote: IngresoLote) => {
          const date = new Date(lote.date);
          return date >= from && date <= to;
       });
    }

    return result;
  }, [ingresos, searchTerm, dateRange]);

  // KPIs
  const kpis = useMemo(() => {
     return filteredIngresos.reduce((acc, lote: IngresoLote) => ({
        totalCost: acc.totalCost + (lote.total_cost || 0),
        totalJavas: acc.totalJavas + (lote.total_javas || 0),
        trucks: acc.trucks + 1
     }), { totalCost: 0, totalJavas: 0, trucks: 0 });
  }, [filteredIngresos]);

  // Pagination Logic
  const paginatedIngresos = useMemo(() => {
     const start = (currentPage - 1) * itemsPerPage;
     return filteredIngresos.slice(start, start + itemsPerPage);
  }, [filteredIngresos, currentPage]);

  const totalPages = Math.ceil(filteredIngresos.length / itemsPerPage);

  // Pagination Handlers
  const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
          setCurrentPage(newPage);
      }
  };

  // Reset page when filter changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange]);


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

  // 🔍 LOGISTICS EXCEPTION LOGIC
  // If all items are configured as "Local" (requires_transport_data = false), Truck Plate is optional.
  const isLogisticsRequired = useMemo(() => {
      // If list is empty or has items without product selected, default to required
      if (items.length === 0) return true;
      
      const hasOnlyLocalProducts = items.every(item => {
          if (!item.product_id) return false; // Not selected yet -> treat as potentially non-local -> required
          const product = products.find((p: any) => p.id === item.product_id);
          if (!product) return false;
          
          // Check the configuration flag
          // If requires_transport_data is false, it's a local product (no plate needed)
          return product.requires_transport_data === false;
      });

      return !hasOnlyLocalProducts;
  }, [items, products]);

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
    // Check truck ID only if logistics required
    if (isLogisticsRequired && !truckId.trim()) {
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
    const product = products.find((p: { id: number; name: string; quality: string; type: string }) => p.id === productId);
    return product ? `${product.name} - ${product.type} - ${product.quality}` : `Producto #${productId}`;
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
              {/* Truck ID - Conditionally Hidden or Optional */}
              <div className={`space-y-2 ${!isLogisticsRequired ? 'opacity-60' : ''}`}>
                <Label htmlFor="truckId" className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Placa del Camión { !isLogisticsRequired && <span className="text-xs font-normal text-green-600">(Opcional - Mercadería Local)</span> }
                </Label>
                <Input
                  id="truckId"
                  value={truckId}
                  onChange={(e) => setTruckId(e.target.value.toUpperCase())}
                  placeholder={isLogisticsRequired ? "ABC-123" : "Opcional"}
                  className="font-mono"
                  required={isLogisticsRequired}
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
                        
                        {/* 🆕 PRODUCT SELECTION (POS GRID DIALOG) - Full Width */}
                        <div className="col-span-1 sm:col-span-2">
                           <Label className="mb-2 block">Producto</Label>
                           <ProductSelectorDialog 
                              products={products}
                              selectedProductId={item.product_id}
                              onSelect={(id) => handleProductChange(index, id)}
                              disabled={productsLoading || createIngreso.isPending}
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

        {/* Recent Ingresos REDESIGN */}
        <Card className="flex flex-col h-fit">
          <CardHeader className="pb-3">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                   <CardTitle className="flex items-center gap-2">
                       <Package className="h-5 w-5" />
                       Lotes Recientes
                   </CardTitle>
                   <CardDescription>Gestión de ingresos por camión</CardDescription>
                </div>
                
                {/* KPIs Summary */}
                <div className="flex divide-x border rounded-lg bg-gray-50/50 shadow-sm">
                    <div className="px-3 py-2 text-center">
                        <span className="text-xs text-gray-500 uppercase font-bold block">Gasto Total</span>
                        <span className="text-green-600 font-bold">S/. {kpis.totalCost.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="px-3 py-2 text-center">
                        <span className="text-xs text-gray-500 uppercase font-bold block">Javas</span>
                        <span className="font-bold">{kpis.totalJavas.toFixed(1)}</span>
                    </div>
                     <div className="px-3 py-2 text-center">
                        <span className="text-xs text-gray-500 uppercase font-bold block">Camiones</span>
                        <span className="font-bold">{kpis.trucks}</span>
                    </div>
                </div>
             </div>
          </CardHeader>

          <CardContent className="space-y-4">
             {/* Toolbar */}
             <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Buscar placa, proveedor..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <DateRangePicker 
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    className="w-full md:w-[260px]"
                />
             </div>

             {/* Content List */}
             {ingresosLoading ? (
                <div className="text-center py-12">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                   <p className="text-gray-500">Cargando lotes...</p>
                </div>
             ) : filteredIngresos.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-gray-50">
                    <Filter className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium">No se encontraron resultados</p>
                    <p className="text-xs text-gray-400">Prueba ajustando los filtros</p>
                </div>
             ) : (
                <div className="space-y-4">
                    {paginatedIngresos.map((lote: IngresoLote) => (
                        <div key={lote.id} className="border rounded-lg overflow-hidden shadow-sm bg-white transition-all hover:shadow-md">
                            {/* Header Card */}
                            <div className="bg-gray-50/80 p-3 border-b flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-full border shadow-sm">
                                        <Truck className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-lg">{lote.truck_plate}</span>
                                            <Badge variant="outline" className="text-xs font-normal text-gray-500 bg-white border-gray-200">
                                                {formatDate(lote.date)}
                                            </Badge>
                                        </div>
                                        <span className="text-xs text-gray-400 font-mono">ID: #{lote.id}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs text-gray-500 uppercase font-bold tracking-wider">Costo Total</span>
                                    <span className="text-xl font-bold text-green-700">
                                        S/. {(lote.total_cost || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Body Table */}
                            <div className="p-0 overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-gray-50/30">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[180px]">Proveedor</TableHead>
                                            <TableHead className="min-w-[200px]">Producto</TableHead>
                                            <TableHead className="text-right">Cantidad</TableHead>
                                            <TableHead className="text-right">Costo Unit.</TableHead>
                                            <TableHead className="text-right">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lote.items?.map((item, idx) => (
                                            <TableRow key={idx} className="hover:bg-gray-50/50">
                                                <TableCell className="font-medium">
                                                    <Badge variant="secondary" className="font-normal rounded-sm">
                                                        {item.supplier_name}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                         <span className="font-medium text-gray-900">
                                                             {item.product?.name || item.product_name}
                                                         </span>
                                                         {(item.product?.type || item.product?.quality) && (
                                                             <span className="text-xs text-gray-500">
                                                                 {item.product?.type} - {item.product?.quality}
                                                             </span>
                                                         )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-medium">{Number(item.quantity_javas).toFixed(2)} javas</span>
                                                        <span className="text-xs text-gray-400">({Number(item.total_kg).toFixed(2)} kg)</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-gray-600">
                                                    S/. {Number(item.cost_per_java).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-gray-900">
                                                    S/. {Number(item.total_cost).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Footer Actions */}
                            <div className="bg-gray-50 p-2 flex justify-end gap-2 border-t">
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0" 
                                    onClick={() => alert("La edición estará disponible próximamente.\n\nPara corregir, elimine este ingreso y créelo nuevamente.")}
                                    title="Editar (Próximamente)"
                                >
                                    <Edit className="h-4 w-4 text-gray-500" />
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 group" 
                                    onClick={() => handleDelete(lote.id)}
                                    disabled={deleteIngreso.isPending}
                                    title="Eliminar y Revertir Stock"
                                >
                                    <Trash2 className={`h-4 w-4 ${deleteIngreso.isPending ? 'text-gray-300' : 'text-gray-500 group-hover:text-red-600'}`} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
             )}

             {/* Pagination */}
             {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
