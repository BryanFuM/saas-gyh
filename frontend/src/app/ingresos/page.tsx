'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Truck, Package, Plus } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  type: string;
  quality: string;
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
  const [productId, setProductId] = useState('');
  const [totalKg, setTotalKg] = useState('');
  const [conversionFactor, setConversionFactor] = useState('20');
  const [unitCostPrice, setUnitCostPrice] = useState('');

  // Calculated javas
  const calculatedJavas = totalKg && conversionFactor 
    ? (parseFloat(totalKg) / parseFloat(conversionFactor)).toFixed(2) 
    : '0';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          product_id: parseInt(productId),
          total_kg: parseFloat(totalKg),
          conversion_factor: parseFloat(conversionFactor),
          unit_cost_price: parseFloat(unitCostPrice),
        }),
      });

      if (!response.ok) {
        throw new Error('Error al registrar ingreso');
      }

      toast({
        title: "Éxito",
        description: "Ingreso de mercadería registrado correctamente",
      });

      // Reset form
      setTruckId('');
      setSupplierName('');
      setProductId('');
      setTotalKg('');
      setConversionFactor('20');
      setUnitCostPrice('');

      // Refresh list
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
                <Label htmlFor="product">Producto</Label>
                <Select value={productId} onValueChange={setProductId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} - {product.type} ({product.quality})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Javas Calculadas:</strong> {calculatedJavas} javas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitCostPrice">Precio Costo por Java (S/.)</Label>
                <Input
                  id="unitCostPrice"
                  type="number"
                  step="0.01"
                  value={unitCostPrice}
                  onChange={(e) => setUnitCostPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
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
                        <p className="font-medium">Camión: {ingreso.truck_id}</p>
                        <p className="text-sm text-gray-500">{ingreso.supplier_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{ingreso.total_javas.toFixed(2)} javas</p>
                        <p className="text-sm text-gray-500">{ingreso.total_kg} kg</p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between text-sm text-gray-500">
                      <span>Costo: S/. {ingreso.unit_cost_price}/java</span>
                      <span>{new Date(ingreso.date).toLocaleDateString()}</span>
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
