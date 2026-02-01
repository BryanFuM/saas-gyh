'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  useProductTypes, 
  useProductQualities,
  useCreateProductType,
  useDeleteProductType,
  useCreateProductQuality,
  useDeleteProductQuality,
} from '@/hooks/use-products-supabase';
import { supabase } from '@/lib/supabase';
import { Tag, Star, Trash2, Plus, AlertTriangle, Settings } from 'lucide-react';
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

interface ManageConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageConfigModal({ open, onOpenChange }: ManageConfigModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('tipos');
  
  // Types state
  const { data: types = [], isLoading: typesLoading } = useProductTypes();
  const createTypeMutation = useCreateProductType();
  const deleteTypeMutation = useDeleteProductType();
  const [newType, setNewType] = useState('');
  const [deletingType, setDeletingType] = useState<{ id: number; name: string } | null>(null);
  const [typeUsageCount, setTypeUsageCount] = useState<number>(0);
  const [isCheckingTypeUsage, setIsCheckingTypeUsage] = useState(false);
  
  // Qualities state
  const { data: qualities = [], isLoading: qualitiesLoading } = useProductQualities();
  const createQualityMutation = useCreateProductQuality();
  const deleteQualityMutation = useDeleteProductQuality();
  const [newQuality, setNewQuality] = useState('');
  const [deletingQuality, setDeletingQuality] = useState<{ id: number; name: string } | null>(null);
  const [qualityUsageCount, setQualityUsageCount] = useState<number>(0);
  const [isCheckingQualityUsage, setIsCheckingQualityUsage] = useState(false);

  const addType = async () => {
    if (!newType.trim()) return;
    try {
      await createTypeMutation.mutateAsync(newType.trim());
      toast({ title: "Éxito", description: "Tipo agregado" });
      setNewType('');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const confirmDeleteType = async (type: { id: number; name: string }) => {
    setIsCheckingTypeUsage(true);
    try {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('type', type.name);
      
      if (error) throw error;
      setTypeUsageCount(count || 0);
      setDeletingType(type);
    } catch (error) {
      console.error('Error checking usage:', error);
      setTypeUsageCount(0);
      setDeletingType(type);
    } finally {
      setIsCheckingTypeUsage(false);
    }
  };

  const handleDeleteType = async () => {
    if (!deletingType) return;
    try {
      await deleteTypeMutation.mutateAsync(deletingType.id);
      toast({ title: "Éxito", description: "Tipo eliminado" });
      setDeletingType(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const addQuality = async () => {
    if (!newQuality.trim()) return;
    try {
      await createQualityMutation.mutateAsync(newQuality.trim());
      toast({ title: "Éxito", description: "Calidad agregada" });
      setNewQuality('');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const confirmDeleteQuality = async (quality: { id: number; name: string }) => {
    setIsCheckingQualityUsage(true);
    try {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('quality', quality.name);
      
      if (error) throw error;
      setQualityUsageCount(count || 0);
      setDeletingQuality(quality);
    } catch (error) {
      console.error('Error checking usage:', error);
      setQualityUsageCount(0);
      setDeletingQuality(quality);
    } finally {
      setIsCheckingQualityUsage(false);
    }
  };

  const handleDeleteQuality = async () => {
    if (!deletingQuality) return;
    try {
      await deleteQualityMutation.mutateAsync(deletingQuality.id);
      toast({ title: "Éxito", description: "Calidad eliminada" });
      setDeletingQuality(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality.toLowerCase()) {
      case 'primera': return 'bg-green-100 text-green-800';
      case 'segunda': return 'bg-yellow-100 text-yellow-800';
      case 'tercera': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Gestionar Tipos y Calidades
            </DialogTitle>
            <DialogDescription>
              Administra los tipos y calidades disponibles para productos
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tipos" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tipos
              </TabsTrigger>
              <TabsTrigger value="calidades" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Calidades
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tipos" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nuevo tipo..."
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addType()}
                />
                <Button onClick={addType} disabled={createTypeMutation.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {typesLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
                ) : types.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay tipos</p>
                ) : (
                  types.map((type: any) => (
                    <div key={type.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-blue-500" />
                        <span>{type.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => confirmDeleteType(type)} disabled={isCheckingTypeUsage}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="calidades" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nueva calidad..."
                  value={newQuality}
                  onChange={(e) => setNewQuality(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addQuality()}
                />
                <Button onClick={addQuality} disabled={createQualityMutation.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {qualitiesLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
                ) : qualities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay calidades</p>
                ) : (
                  qualities.map((quality: any) => (
                    <div key={quality.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className={`px-2 py-0.5 rounded text-sm ${getQualityColor(quality.name)}`}>
                          {quality.name}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => confirmDeleteQuality(quality)} disabled={isCheckingQualityUsage}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingType} onOpenChange={() => setDeletingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {typeUsageCount > 0 && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              Eliminar Tipo
            </AlertDialogTitle>
            <AlertDialogDescription>
              {typeUsageCount > 0 ? (
                <>El tipo <strong>{deletingType?.name}</strong> está siendo usado por <strong>{typeUsageCount} producto(s)</strong>.</>
              ) : (
                <>¿Estás seguro de eliminar el tipo <strong>{deletingType?.name}</strong>?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteType} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingQuality} onOpenChange={() => setDeletingQuality(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {qualityUsageCount > 0 && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              Eliminar Calidad
            </AlertDialogTitle>
            <AlertDialogDescription>
              {qualityUsageCount > 0 ? (
                <>La calidad <strong>{deletingQuality?.name}</strong> está siendo usada por <strong>{qualityUsageCount} producto(s)</strong>.</>
              ) : (
                <>¿Estás seguro de eliminar la calidad <strong>{deletingQuality?.name}</strong>?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuality} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
