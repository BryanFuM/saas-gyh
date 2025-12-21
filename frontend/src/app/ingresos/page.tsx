'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Truck, Package, Plus, Scale, ArrowRight } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ProductSelect } from '@/components/ui/searchable-select';

interface Product {
  id: number;
  name: string;
  type: string;
  quality: string;
  conversion_factor: number;
}

interface Ingreso {
  id: number;
  truck_id: string;
  supplier_name: string;
  product_id: number;
  total_kg: number;
  conversion_factor: number;
  total_javas: number;
  unit_cost_price: number;
  date: string;
}

export default function IngresosPage() {
  const { token } = useAuthStore();
  const { toast } = useToast();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [truckId, setTruckId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [productId, setProductId] = useState<number | null>(null);
  const [totalKg, setTotalKg] = useState('');
  const [conversionFactor, setConversionFactor] = useState('20');
  
  // Cost price flexibility
  const [costPriceMode, setCostPriceMode] = useState<'JAVA' | 'KG'>('JAVA');
  const [costPriceInput, setCostPriceInput] = useState('');

  // Calculated javas
  const calculatedJavas = totalKg && conversionFactor 
    ? (parseFloat(totalKg) / parseFloat(conversionFactor)).toFixed(2) 
    : '0';

  // Calculate cost per java based on mode
  const costPerJava = (() => {
    if (!costPriceInput || !conversionFactor) return 0;
    const inputValue = parseFloat(costPriceInput);
    if (costPriceMode === 'KG') {
      // Convert price per KG to price per Java
      return inputValue * parseFloat(conversionFactor);
    }
    return inputValue;
  })();

  // Calculate cost per kg for display
  const costPerKg = (() => {
    if (!costPriceInput || !conversionFactor) return 0;
    const inputValue = parseFloat(costPriceInput);
    if (costPriceMode === 'JAVA') {
      // Convert price per Java to price per KG
      return inputValue / parseFloat(conversionFactor);
    }
    return inputValue;
  })();

  // Auto-set conversion factor when product changes
  useEffect(() => {
    if (productId) {
      const product = products.find(p => p.id === productId);
      if (product?.conversion_factor) {
        setConversionFactor(product.conversion_factor.toString());
      }
    }
  }, [productId, products]);

  useEffect(() => {
    fetchProducts();
    fetchIngresos();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/python/products', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchIngresos = async () => {
    try {
      const response = await fetch('/api/python/ingresos', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setIngresos(data);
      }
    } catch (error) {
      console.error('Error fetching ingresos:', error);
    }
  };

  const resetForm = () => {
    setTruckId('');
    setSupplierName('');
    setProductId(null);
    setTotalKg('');
    setConversionFactor('20');
    setCostPriceInput('');
    setCostPriceMode('JAVA');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      toast({ title: "Error", description: "Selecciona un producto", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/python/ingresos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          truck_id: truckId,
          supplier_name: supplierName,
          product_id: productId,
          total_kg: parseFloat(totalKg),
          conversion_factor: parseFloat(conversionFactor),
          unit_cost_price: costPerJava, // Always send price per Java
        }),
      });

      if (!response.ok) {
        throw new Error('Error al registrar ingreso');
      }

      toast({
        title: "Éxito",
        description: "Ingreso de mercadería registrado correctamente",
      });

      resetForm();
      fetchIngresos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return 'Fecha inválida';
      return format(date, "dd MMM yyyy", { locale: es });
    } catch {
      return 'Fecha inválida';
    }
  };

  const getProductName = (productId: number): string => {
    const product = products.find(p => p.id === productId);
    return product ? `${product.name} (${product.quality})` : `Producto #${productId}`;
  };

  // Create stock map (empty for ingresos, just need the product info)
  const stockMap: Record<number, number> = {};

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Truck className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Ingreso de Mercadería</h1>
          <p className="text-sm md:text-base text-gray-500">Registra la llegada de nuevos productos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Form */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Plus className="h-5 w-5" />
              Nuevo Ingreso
            </CardTitle>
            <CardDescription>Completa los datos del camión y mercadería</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="truckId">ID Camión / Placa</Label>
                  <Input
                    id="truckId"
                    value={truckId}
                    onChange={(e) => setTruckId(e.target.value)}
                    placeholder="ABC-123"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplierName">Proveedor</Label>
                  <Input
                    id="supplierName"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Nombre del proveedor"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Producto</Label>
                <ProductSelect
                  products={products}
                  stockMap={stockMap}
                  value={productId}
                  onSelect={setProductId}
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalKg">Total KG</Label>
                  <Input
                    id="totalKg"
                    type="number"
                    step="0.01"
                    value={totalKg}
                    onChange={(e) => setTotalKg(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conversionFactor">Factor (KG/Java)</Label>
                  <Input
                    id="conversionFactor"
                    type="number"
                    step="0.1"
                    value={conversionFactor}
                    onChange={(e) => setConversionFactor(e.target.value)}
                    placeholder="20"
                    required
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-blue-700">
                  <strong>Javas Calculadas:</strong> {calculatedJavas} javas
                </p>
              </div>

              {/* Cost Price with Mode Selection */}
              <div className="space-y-3 p-4 border rounded-lg">
                <Label className="text-base font-medium">Precio de Costo</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={costPriceMode === 'JAVA' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCostPriceMode('JAVA')}
                    className="flex-1"
                  >
                    Por Java
                  </Button>
                  <Button
                    type="button"
                    variant={costPriceMode === 'KG' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCostPriceMode('KG')}
                    className="flex-1"
                  >
                    Por KG
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPriceInput">
                    Precio por {costPriceMode === 'JAVA' ? 'Java' : 'KG'} (S/.)
                  </Label>
                  <Input
                    id="costPriceInput"
                    type="number"
                    step="0.01"
                    value={costPriceInput}
                    onChange={(e) => setCostPriceInput(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                {costPriceInput && parseFloat(costPriceInput) > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>S/. {costPerKg.toFixed(2)}/kg</span>
                      <ArrowRight className="h-4 w-4" />
                      <span className="text-gray-600">S/. {costPerJava.toFixed(2)}/java</span>
                    </div>
                    {totalKg && (
                      <p className="font-medium text-primary">
                        Costo Total: S/. {(costPerJava * parseFloat(calculatedJavas)).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !productId}>
                {isLoading ? 'Registrando...' : 'Registrar Ingreso'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Ingresos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Ingresos Recientes
            </CardTitle>
            <CardDescription>Últimos ingresos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {ingresos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay ingresos registrados</p>
            ) : (
              <div className="space-y-3">
                {ingresos.slice(0, 10).map((ingreso) => (
                  <div key={ingreso.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{getProductName(ingreso.product_id)}</p>
                        <p className="text-sm text-gray-500">
                          Camión: {ingreso.truck_id} | {ingreso.supplier_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{ingreso.total_javas.toFixed(2)} javas</p>
                        <p className="text-sm text-gray-500">{ingreso.total_kg} kg</p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between text-sm text-gray-500">
                      <span>Costo: S/. {ingreso.unit_cost_price.toFixed(2)}/java</span>
                      <span>{formatDate(ingreso.date)}</span>
                    </div>
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
