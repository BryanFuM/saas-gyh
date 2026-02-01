'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CreatableSelect } from '@/components/ui/creatable-select';
import { useToast } from '@/hooks/use-toast';
import { 
  useProducts, 
  useCreateProduct, 
  useUpdateProduct, 
  useDeleteProduct,
  useProductTypes,
  useProductQualities,
  useCreateProductType,
  useCreateProductQuality,
  Product,
} from '@/hooks/use-products-supabase';
import { ManageConfigModal } from './components/manage-config-modal';

// Tipos locales (ya no dependemos de api.ts)
interface ProductType {
  id: number;
  name: string;
}

interface ProductQuality {
  id: number;
  name: string;
}
import { Package, Plus, Edit, Trash2, Scale, Settings } from 'lucide-react';
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

export default function ProductosPage() {
  const { user, isHydrated, hydrate } = useAuthStore();
  const { toast } = useToast();
  
  // Data queries
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: types = [], isLoading: typesLoading } = useProductTypes();
  const { data: qualities = [], isLoading: qualitiesLoading } = useProductQualities();
  
  // Mutations
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const createTypeMutation = useCreateProductType();
  const createQualityMutation = useCreateProductQuality();
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [quality, setQuality] = useState('');
  const [conversionFactor, setConversionFactor] = useState(20);
  
  // Edit state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editQuality, setEditQuality] = useState('');
  const [editConversionFactor, setEditConversionFactor] = useState(20);
  
  // Delete state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const resetProductForm = () => {
    setName('');
    setType('');
    setQuality('');
    setConversionFactor(20);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createProductMutation.mutateAsync({
        name,
        type,
        quality,
        conversion_factor: conversionFactor,
      });

      toast({
        title: "Éxito",
        description: "Producto creado correctamente",
      });

      resetProductForm();
      setIsDialogOpen(false);
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
      await updateProductMutation.mutateAsync({
        id: editingProduct.id,
        data: {
          name: editName,
          type: editType,
          quality: editQuality,
          conversion_factor: editConversionFactor,
        },
      });

      toast({
        title: "Éxito",
        description: "Producto actualizado correctamente",
      });

      setIsEditDialogOpen(false);
      setEditingProduct(null);
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
      await deleteProductMutation.mutateAsync(deletingProduct.id);

      toast({
        title: "Éxito",
        description: "Producto eliminado correctamente",
      });

      setIsDeleteDialogOpen(false);
      setDeletingProduct(null);
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

  // Prepare options for CreatableSelect
  const typeOptions = types.map((t: ProductType) => ({ value: t.name, label: t.name }));
  const qualityOptions = qualities.map((q: ProductQuality) => ({ value: q.name, label: q.name }));

  // Handler to create new type inline
  const handleCreateType = async (name: string) => {
    await createTypeMutation.mutateAsync(name);
  };

  // Handler to create new quality inline
  const handleCreateQuality = async (name: string) => {
    await createQualityMutation.mutateAsync(name);
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';
  const isLoading = productsLoading || typesLoading || qualitiesLoading;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Productos</h1>
            <p className="text-sm md:text-base text-gray-500">Gestiona el catálogo de productos</p>
          </div>
        </div>

        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsConfigModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Tipos/Calidades</span>
              </Button>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Producto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Nuevo Producto</DialogTitle>
                    <DialogDescription>
                      Define el nombre, tipo, calidad y factor de conversión. Puedes crear nuevos tipos y calidades escribiendo en el selector.
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
                        <CreatableSelect
                          options={typeOptions}
                          value={type}
                          onSelect={(val) => setType(val)}
                          onCreate={handleCreateType}
                          placeholder="Seleccionar o crear tipo..."
                          searchPlaceholder="Buscar o crear tipo..."
                          createLabel="Crear tipo"
                          isLoading={typesLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quality">Calidad</Label>
                        <CreatableSelect
                          options={qualityOptions}
                          value={quality}
                          onSelect={(val) => setQuality(val)}
                          onCreate={handleCreateQuality}
                          placeholder="Seleccionar o crear calidad..."
                          searchPlaceholder="Buscar o crear calidad..."
                          createLabel="Crear calidad"
                          isLoading={qualitiesLoading}
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
                      <Button 
                        type="submit" 
                        disabled={!name || !type || !quality || createProductMutation.isPending}
                      >
                        {createProductMutation.isPending ? 'Guardando...' : 'Guardar Producto'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Products Grid */}
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
          {products.map((product: Product) => (
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

      {/* Manage Config Modal */}
      <ManageConfigModal 
        open={isConfigModalOpen} 
        onOpenChange={setIsConfigModalOpen} 
      />

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Modifica los datos del producto. Puedes crear nuevos tipos y calidades escribiendo en el selector.
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
                <CreatableSelect
                  options={typeOptions}
                  value={editType}
                  onSelect={(val) => setEditType(val)}
                  onCreate={handleCreateType}
                  placeholder="Seleccionar o crear tipo..."
                  searchPlaceholder="Buscar o crear tipo..."
                  createLabel="Crear tipo"
                  isLoading={typesLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editQuality">Calidad</Label>
                <CreatableSelect
                  options={qualityOptions}
                  value={editQuality}
                  onSelect={(val) => setEditQuality(val)}
                  onCreate={handleCreateQuality}
                  placeholder="Seleccionar o crear calidad..."
                  searchPlaceholder="Buscar o crear calidad..."
                  createLabel="Crear calidad"
                  isLoading={qualitiesLoading}
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
              <Button type="submit" disabled={updateProductMutation.isPending}>
                {updateProductMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
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
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
