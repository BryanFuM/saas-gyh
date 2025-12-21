'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Edit, Trash2, Tag, Star, Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Product {
  id: number;
  name: string;
  type: string;
  quality: string;
  conversion_factor: number;
}

interface ProductType {
  id: number;
  name: string;
}

interface ProductQuality {
  id: number;
  name: string;
}

export default function ProductosPage() {
  const { token, user, isHydrated, hydrate } = useAuthStore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('productos');
  const [products, setProducts] = useState<Product[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [qualities, setQualities] = useState<ProductQuality[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [quality, setQuality] = useState('');
  const [conversionFactor, setConversionFactor] = useState(20);
  
  // Edit state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editQuality, setEditQuality] = useState('');
  const [editConversionFactor, setEditConversionFactor] = useState(20);
  
  // Delete state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  
  // Type/Quality form state
  const [newType, setNewType] = useState('');
  const [newQuality, setNewQuality] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fetchData = async () => {
    try {
      const [productsRes, typesRes, qualitiesRes] = await Promise.all([
        fetch('/api/python/products', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/python/config/product-types', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/python/config/product-qualities', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      
      if (productsRes.ok) setProducts(await productsRes.json());
      if (typesRes.ok) setTypes(await typesRes.json());
      if (qualitiesRes.ok) setQualities(await qualitiesRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetProductForm = () => {
    setName('');
    setType('');
    setQuality('');
    setConversionFactor(20);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/python/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          type,
          quality,
          conversion_factor: conversionFactor,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al crear producto');
      }

      toast({
        title: "Éxito",
        description: "Producto creado correctamente",
      });

      resetProductForm();
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditType(product.type);
    setEditQuality(product.quality);
    setEditConversionFactor(product.conversion_factor || 20);
    setIsEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const response = await fetch(`/api/python/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          type: editType,
          quality: editQuality,
          conversion_factor: editConversionFactor,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al actualizar producto');
      }

      toast({
        title: "Éxito",
        description: "Producto actualizado correctamente",
      });

      setIsEditDialogOpen(false);
      setEditingProduct(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (product: Product) => {
    setDeletingProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;

    try {
      const response = await fetch(`/api/python/products/${deletingProduct.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al eliminar producto');
      }

      toast({
        title: "Éxito",
        description: "Producto eliminado correctamente",
      });

      setIsDeleteDialogOpen(false);
      setDeletingProduct(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality.toLowerCase()) {
      case 'primera':
        return 'bg-green-100 text-green-800';
      case 'segunda':
        return 'bg-yellow-100 text-yellow-800';
      case 'tercera':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Types CRUD
  const addType = async () => {
    if (!newType.trim()) return;

    try {
      const response = await fetch('/api/python/config/product-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newType }),
      });

      if (!response.ok) throw new Error('Error al crear tipo');

      toast({ title: "Éxito", description: "Tipo agregado" });
      setNewType('');
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteType = async (id: number) => {
    try {
      await fetch(`/api/python/config/product-types/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      toast({ title: "Éxito", description: "Tipo eliminado" });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Qualities CRUD
  const addQuality = async () => {
    if (!newQuality.trim()) return;

    try {
      const response = await fetch('/api/python/config/product-qualities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newQuality }),
      });

      if (!response.ok) throw new Error('Error al crear calidad');

      toast({ title: "Éxito", description: "Calidad agregada" });
      setNewQuality('');
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteQuality = async (id: number) => {
    try {
      await fetch(`/api/python/config/product-qualities/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      toast({ title: "Éxito", description: "Calidad eliminada" });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Prepare options for SearchableSelect
  const typeOptions = types.map(t => ({ value: t.name, label: t.name }));
  const qualityOptions = qualities.map(q => ({ value: q.name, label: q.name }));

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Catálogo</h1>
            <p className="text-sm md:text-base text-gray-500">Gestiona productos, tipos y calidades</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="productos" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Productos</span>
          </TabsTrigger>
          <TabsTrigger value="tipos" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Tipos</span>
          </TabsTrigger>
          <TabsTrigger value="calidades" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Calidades</span>
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="productos">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Lista de Productos</h2>
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={types.length === 0 || qualities.length === 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Producto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Nuevo Producto</DialogTitle>
                    <DialogDescription>
                      Define el nombre, tipo, calidad y factor de conversión del producto
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre del Producto</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ej: Kion Fresco"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">Tipo</Label>
                        <Input
                          id="type"
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                          placeholder="Ej: Kion, Cúrcuma, etc."
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quality">Calidad</Label>
                        <Input
                          id="quality"
                          value={quality}
                          onChange={(e) => setQuality(e.target.value)}
                          placeholder="Ej: Primera, Segunda, etc."
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="conversionFactor">
                          <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4" />
                            Factor de Conversión (kg por Java)
                          </div>
                        </Label>
                        <Input
                          id="conversionFactor"
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={conversionFactor}
                          onChange={(e) => setConversionFactor(parseFloat(e.target.value) || 20)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Cuántos kilogramos equivalen a una java de este producto
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={!name || !type || !quality}>
                        Guardar Producto
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {isAdmin && (types.length === 0 || qualities.length === 0) && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4">
              <p className="text-sm">
                ⚠️ Debes configurar al menos un tipo y una calidad antes de crear productos.{' '}
                <button onClick={() => setActiveTab('tipos')} className="underline font-medium">
                  Ir a Tipos
                </button>
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No hay productos registrados</p>
                <p className="text-gray-400 text-sm">
                  {isAdmin 
                    ? 'Agrega tu primer producto usando el botón "Nuevo Producto"' 
                    : 'Contacta al administrador para agregar productos'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <Card key={product.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <Badge className={getQualityColor(product.quality)}>
                        {product.quality}
                      </Badge>
                    </div>
                    <CardDescription>
                      Tipo: {product.type}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        <p>ID: #{product.id}</p>
                        <p className="flex items-center gap-1">
                          <Scale className="h-3 w-3" />
                          {product.conversion_factor || 20} kg/java
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => openDeleteDialog(product)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Types Tab */}
        <TabsContent value="tipos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tipos de Producto
              </CardTitle>
              <CardDescription>
                Define los tipos de producto disponibles (ej: Kion, Cúrcuma, Jengibre)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAdmin && (
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Nuevo tipo..."
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addType()}
                  />
                  <Button onClick={addType} disabled={!newType.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <div className="space-y-2">
                {types.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay tipos definidos</p>
                ) : (
                  types.map((type) => (
                    <div key={type.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span>{type.name}</span>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => deleteType(type.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Qualities Tab */}
        <TabsContent value="calidades">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Calidades de Producto
              </CardTitle>
              <CardDescription>
                Define las calidades disponibles (ej: Primera, Segunda, Tercera)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAdmin && (
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Nueva calidad..."
                    value={newQuality}
                    onChange={(e) => setNewQuality(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addQuality()}
                  />
                  <Button onClick={addQuality} disabled={!newQuality.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <div className="space-y-2">
                {qualities.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay calidades definidas</p>
                ) : (
                  qualities.map((quality) => (
                    <div key={quality.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-muted-foreground" />
                        <span>{quality.name}</span>
                        <Badge className={getQualityColor(quality.name)} variant="secondary">
                          Vista previa
                        </Badge>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => deleteQuality(quality.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Modifica los datos del producto
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Nombre del Producto</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editType">Tipo</Label>
                <Input
                  id="editType"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  placeholder="Ej: Kion, Cúrcuma, etc."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editQuality">Calidad</Label>
                <Input
                  id="editQuality"
                  value={editQuality}
                  onChange={(e) => setEditQuality(e.target.value)}
                  placeholder="Ej: Primera, Segunda, etc."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editConversionFactor">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Factor de Conversión (kg por Java)
                  </div>
                </Label>
                <Input
                  id="editConversionFactor"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={editConversionFactor}
                  onChange={(e) => setEditConversionFactor(parseFloat(e.target.value) || 20)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el producto &quot;{deletingProduct?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
