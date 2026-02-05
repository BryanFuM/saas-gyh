'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CreatableSelect } from '@/components/ui/creatable-select';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  useProducts, 
  useCreateProduct, 
  useUpdateProduct, 
  useDeleteProduct,
  useProductTypes,
  useProductQualities,
  useCreateProductType,
  useCreateProductQuality,
  useCheckProductUsage,
  Product,
} from '@/hooks/use-products-supabase';
import { useStock, StockItem } from '@/hooks/use-stock-supabase';
import { ManageConfigModal } from './components/manage-config-modal';
import { KardexDialog } from './components/kardex-dialog';

// Tipos locales
interface ProductType {
  id: number;
  name: string;
}

interface ProductQuality {
  id: number;
  name: string;
}

import { Package, Plus, Edit, Trash2, Scale, Settings, LayoutGrid, List as ListIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const { data: stockItems = [], isLoading: stockLoading } = useStock();
  const { data: types = [], isLoading: typesLoading } = useProductTypes();
  const { data: qualities = [], isLoading: qualitiesLoading } = useProductQualities();
  
  // Mutations
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const checkProductUsageMutation = useCheckProductUsage();
  const createTypeMutation = useCreateProductType();
  const createQualityMutation = useCreateProductQuality();
  
  // States
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [quality, setQuality] = useState('');
  const [conversionFactor, setConversionFactor] = useState(20);
  const [requiresTransport, setRequiresTransport] = useState(true);

  // Edit states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editQuality, setEditQuality] = useState('');
  const [editConversionFactor, setEditConversionFactor] = useState(20);
  const [editRequiresTransport, setEditRequiresTransport] = useState(true);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  // Delete state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string>('');
  const [isSoftDelete, setIsSoftDelete] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Derived State
  const stockMap = useMemo(() => {
    const map = new Map<number, StockItem>();
    stockItems.forEach(item => map.set(item.product_id, item));
    return map;
  }, [stockItems]);

  const normalizeName = (name: string) => {
    if (!name) return '';
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  };

  const uniqueProductNames = useMemo(() => {
    const names = new Set(products.map(p => normalizeName(p.name)));
    return Array.from(names).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    if (activeCategory !== 'all') {
      filtered = products.filter(p => normalizeName(p.name) === activeCategory);
    }
    
    // Sort by Type ASC, then Quality ASC (as requested)
    return [...filtered].sort((a, b) => {
       const typeCompare = a.type.localeCompare(b.type);
       if (typeCompare !== 0) return typeCompare;
       return a.quality.localeCompare(b.quality);
    });
  }, [products, activeCategory]);

  const resetProductForm = () => {
    setName('');
    setType('');
    setQuality('');
    setConversionFactor(20);
    setRequiresTransport(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createProductMutation.mutateAsync({
        name,
        type,
        quality,
        conversion_factor: conversionFactor,
        requires_transport_data: requiresTransport,
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
    setEditRequiresTransport(product.requires_transport_data ?? true);
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
          requires_transport_data: editRequiresTransport,
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

  const openDeleteDialog = async (product: Product) => {
    setDeletingProduct(product);
    setDeleteWarning('Verificando historial...');
    setIsSoftDelete(false);
    setIsDeleteDialogOpen(true);

    try {
      const { has_history, usage_count } = await checkProductUsageMutation.mutateAsync(product.id);
      
      if (has_history) {
         setDeleteWarning(`Este producto tiene ${usage_count} movimientos históricos. Se archivará el producto (Soft Delete) y no aparecerá en nuevas operaciones, pero se mantendrá en los reportes.`);
         setIsSoftDelete(true);
      } else {
         setDeleteWarning('Este producto no tiene uso. Se eliminará permanentemente de la base de datos.');
         setIsSoftDelete(false);
      }
    } catch (error: any) {
       console.error(error);
       setDeleteWarning('No se pudo verificar el historial. Se intentará eliminar.');
    }
  };

  const handleDelete = async () => {
    if (!deleteProductMutation.isPending && deletingProduct) {
      try {
        await deleteProductMutation.mutateAsync(deletingProduct.id);

        toast({
          title: "Éxito",
          description: isSoftDelete ? "Producto archivado correctamente" : "Producto eliminado permanentemente",
        });

        setIsDeleteDialogOpen(false);
        setDeletingProduct(null);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Error al eliminar el producto",
          variant: "destructive",
        });
      }
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality.toLowerCase()) {
      case 'primera':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'segunda':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'tercera':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Stock Styling Logic
  const getStockStatusColor = (stock: number) => {
    if (stock <= 0) return 'text-red-600';
    if (stock < 10) return 'text-amber-600';
    return 'text-green-600';
  };
  
  const getStockBadgeVariant = (stock: number) => {
    if (stock <= 0) return 'destructive'; // Red
    if (stock < 10) return 'secondary'; // Amber-ish usually, but secondary is gray. Let's use custom classes or overwrite
    return 'default'; // Primary/Black
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
  const isLoading = productsLoading || typesLoading || qualitiesLoading || stockLoading;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Monitor de Inventario</h1>
            <p className="text-sm md:text-base text-gray-500">Gestión de productos y stock en tiempo real</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
           <div className="bg-muted p-1 rounded-lg flex items-center mr-2">
              <Button 
                variant={viewMode === 'grid' ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('grid')}
              >
                 <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === 'list' ? "secondary" : "ghost"}
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('list')}
              >
                 <ListIcon className="h-4 w-4" />
              </Button>
           </div>

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
                    Nuevo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Nuevo Producto</DialogTitle>
                    <DialogDescription>
                       Configura el producto base. El stock se añade mediante &quot;Ingresos&quot;.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                      {/* Form Fields Same as Before */}
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ej: Kion Fresco"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label>Tipo</Label>
                           <CreatableSelect
                             options={typeOptions}
                             value={type}
                             onSelect={(val) => setType(val)}
                             onCreate={handleCreateType}
                             placeholder="Seleccionar..."
                             isLoading={typesLoading}
                           />
                         </div>
                         <div className="space-y-2">
                           <Label>Calidad</Label>
                           <CreatableSelect
                             options={qualityOptions}
                             value={quality}
                             onSelect={(val) => setQuality(val)}
                             onCreate={handleCreateQuality}
                             placeholder="Seleccionar..."
                             isLoading={qualitiesLoading}
                           />
                         </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="conversionFactor">Factor de Conversión (Kg/Java)</Label>
                        <Input
                          id="conversionFactor"
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={conversionFactor}
                          onChange={(e) => setConversionFactor(parseFloat(e.target.value) || 20)}
                          required
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox 
                          id="requiresTransport" 
                          checked={requiresTransport}
                          onCheckedChange={(checked) => setRequiresTransport(checked as boolean)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor="requiresTransport">
                                Requiere datos de transporte
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Si está activo, pedirá placa, chofer y lote en los ingresos.
                            </p>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" disabled={createProductMutation.isPending}>Guardar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
         <div className="overflow-x-auto pb-2">
            <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                {uniqueProductNames.map(name => (
                    <TabsTrigger key={name} value={name}>{name}</TabsTrigger>
                ))}
            </TabsList>
         </div>

         <TabsContent value={activeCategory} className="mt-4">
             {isLoading ? (
                <div className="flex justify-center py-12">
                   <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
             ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No se encontraron productos en esta categoría.</p>
                </div>
             ) : (
                <>
                {viewMode === 'grid' ? (
                    // GRID VIEW
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredProducts.map((product) => {
                         const stockItem = stockMap.get(product.id);
                         const stockJavas = stockItem?.stock_javas || 0;
                         const stockStatusClass = getStockStatusColor(stockJavas);
                         
                         return (
                            <Card key={product.id} className="overflow-hidden">
                              <CardHeader className="p-4 pb-2 bg-gray-50/50">
                                <div className="flex justify-between items-start gap-2">
                                  <h3 className="font-semibold text-lg leading-tight truncate" title={product.name}>
                                    {product.name}
                                  </h3>
                                  <Badge variant="outline" className={`${getQualityColor(product.quality)} whitespace-nowrap`}>
                                     {product.quality}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">{product.type}</p>
                              </CardHeader>
                              
                              <CardContent className="p-4 pt-4">
                                  {/* Destacado: Stock */}
                                  <div className="flex flex-col items-center justify-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 mb-4">
                                     <span className={`text-4xl font-extrabold ${stockStatusClass}`}>
                                        {Math.round(stockJavas * 100) / 100}
                                     </span>
                                     <span className="text-sm text-gray-500 font-medium">Javas Disponibles</span>
                                     
                                     <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                                         <Scale className="h-3 w-3" />
                                         <span>~ {Math.round(stockJavas * product.conversion_factor * 100) / 100} Kg</span>
                                         <span className="text-gray-300">|</span>
                                         <span>Base: {product.conversion_factor}kg</span>
                                     </div>
                                  </div>

                                  <div className="flex items-center justify-between mt-2">
                                     <div className="flex items-center gap-2">
                                        {stockJavas <= 0 && <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> Agotado</span>} 
                                        {stockJavas > 0 && stockJavas < 10 && <span className="text-xs font-bold text-amber-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> Stock Bajo</span>}
                                        {stockJavas >= 10 && <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/> Disponible</span>}
                                     </div>

                                     <div className="flex gap-1">
                                        <KardexDialog productId={product.id} productName={product.name} />
                                        {isAdmin && (
                                          <>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(product)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => openDeleteDialog(product)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </>
                                        )}
                                     </div>
                                  </div>
                              </CardContent>
                            </Card>
                         );
                      })}
                    </div>
                ) : (
                    // LIST VIEW (TABLE)
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-center">Factor (Kg/Java)</TableHead>
                                    <TableHead className="text-center">Stock Javas</TableHead>
                                    <TableHead className="text-center">Stock Aprox (Kg)</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.map((product) => {
                                    const stockItem = stockMap.get(product.id);
                                    const stockJavas = stockItem?.stock_javas || 0;
                                    const stockKg = stockItem?.stock_kg || (stockJavas * product.conversion_factor);

                                    return (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900">{product.name}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-[10px] h-5">{product.type}</Badge>
                                                        <Badge variant="outline" className={`${getQualityColor(product.quality)} text-[10px] h-5 border-none`}>{product.quality}</Badge>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center text-gray-500">
                                                {product.conversion_factor}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    className={`${
                                                        stockJavas <= 0 ? 'bg-red-100 text-red-800 hover:bg-red-200' :
                                                        stockJavas < 10 ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' :
                                                        'bg-green-100 text-green-800 hover:bg-green-200'
                                                    } border-none text-base px-3 py-1`}
                                                >
                                                    {Math.round(stockJavas * 100) / 100}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-gray-600">
                                                {Math.round(stockKg * 100) / 100} kg
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <KardexDialog productId={product.id} productName={product.name} />
                                                    {isAdmin && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500" onClick={() => openEditDialog(product)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => openDeleteDialog(product)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
                </>
             )}
         </TabsContent>
      </Tabs>

      {/* MODALS - KEEPING EXISTING ONES */}
      <ManageConfigModal 
        open={isConfigModalOpen} 
        onOpenChange={setIsConfigModalOpen} 
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
             <DialogDescription>Modificando {editingProduct?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Nombre</Label>
                <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Tipo</Label>
                   <CreatableSelect options={typeOptions} value={editType} onSelect={setEditType} onCreate={handleCreateType} isLoading={typesLoading} />
                 </div>
                 <div className="space-y-2">
                   <Label>Calidad</Label>
                   <CreatableSelect options={qualityOptions} value={editQuality} onSelect={setEditQuality} onCreate={handleCreateQuality} isLoading={qualitiesLoading} />
                 </div>
              </div>
              <div className="space-y-2">
                <Label>Factor de Conversión</Label>
                <Input type="number" step="0.1" value={editConversionFactor} onChange={(e) => setEditConversionFactor(parseFloat(e.target.value) || 20)} required />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="editRequiresTransport" 
                  checked={editRequiresTransport}
                  onCheckedChange={(checked) => setEditRequiresTransport(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="editRequiresTransport">
                        Requiere datos de transporte
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        Si está desactivo, permite ingreso simple (ej. local).
                    </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateProductMutation.isPending}>Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>Si eliminas {deletingProduct?.name}, también se podría afectar el historial. Asegúrate de que no tenga movimientos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700" disabled={deleteProductMutation.isPending}>
              {deleteProductMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
