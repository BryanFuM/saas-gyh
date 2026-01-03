'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useProductTypes, useDeleteProductType } from '@/hooks/use-product-types';
import { useProductQualities, useDeleteProductQuality } from '@/hooks/use-product-qualities';
import { api, ProductType, ProductQuality } from '@/lib/api';
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
  const { data: types = [], isLoading: typesLoading, refetch: refetchTypes } = useProductTypes();
  const deleteTypeMutation = useDeleteProductType();
  const [newType, setNewType] = useState('');
  const [deletingType, setDeletingType] = useState<{ id: number; name: string } | null>(null);
  const [typeUsageCount, setTypeUsageCount] = useState<number>(0);
  const [isCheckingTypeUsage, setIsCheckingTypeUsage] = useState(false);
  
  // Qualities state
  const { data: qualities = [], isLoading: qualitiesLoading, refetch: refetchQualities } = useProductQualities();
  const deleteQualityMutation = useDeleteProductQuality();
  const [newQuality, setNewQuality] = useState('');
  const [deletingQuality, setDeletingQuality] = useState<{ id: number; name: string } | null>(null);
  const [qualityUsageCount, setQualityUsageCount] = useState<number>(0);
  const [isCheckingQualityUsage, setIsCheckingQualityUsage] = useState(false);

  const addType = async () => {
    if (!newType.trim()) return;
    try {
      await api.productTypes.create(newType.trim());
      toast({ title: "Éxito", description: "Tipo agregado" });
      setNewType('');
      refetchTypes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const confirmDeleteType = async (type: { id: number; name: string }) => {
    setIsCheckingTypeUsage(true);
    try {
      const result = await api.productTypes.getUsageCount(type.id);
      setTypeUsageCount(result.count);
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
      await api.productQualities.create(newQuality.trim());
      toast({ title: "Éxito", description: "Calidad agregada" });
      setNewQuality('');
      refetchQualities();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const confirmDeleteQuality = async (quality: { id: number; name: string }) => {
    setIsCheckingQualityUsage(true);
    try {
      const result = await api.productQualities.getUsageCount(quality.id);
      setQualityUsageCount(result.count);
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tipos" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tipos ({types.length})
              </TabsTrigger>
              <TabsTrigger value="calidades" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Calidades ({qualities.length})
              </TabsTrigger>
            </TabsList>

            {/* Types Tab */}
            <TabsContent value="tipos" className="mt-4">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Nuevo tipo (ej: Kion, Cúrcuma)..."
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addType()}
                />
                <Button onClick={addType} disabled={!newType.trim()} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {typesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : types.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay tipos definidos</p>
                ) : (
                  types.map((type: ProductType) => (
                    <div key={type.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span>{type.name}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => confirmDeleteType(type)}
                        disabled={isCheckingTypeUsage}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Qualities Tab */}
            <TabsContent value="calidades" className="mt-4">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Nueva calidad (ej: Primera, Segunda)..."
                  value={newQuality}
                  onChange={(e) => setNewQuality(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addQuality()}
                />
                <Button onClick={addQuality} disabled={!newQuality.trim()} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {qualitiesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : qualities.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay calidades definidas</p>
                ) : (
                  qualities.map((quality: ProductQuality) => (
                    <div key={quality.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-muted-foreground" />
                        <span>{quality.name}</span>
                        <span className={`px-2 py-0.5 text-xs rounded ${getQualityColor(quality.name)}`}>
                          Vista previa
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => confirmDeleteQuality(quality)}
                        disabled={isCheckingQualityUsage}
                      >
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

      {/* Delete Type Confirmation */}
      <AlertDialog open={!!deletingType} onOpenChange={() => setDeletingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {typeUsageCount > 0 && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              ¿Eliminar tipo &quot;{deletingType?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {typeUsageCount > 0 ? (
                <>
                  <span className="text-yellow-600 font-medium">
                    Hay {typeUsageCount} producto{typeUsageCount > 1 ? 's' : ''} usando este tipo.
                  </span>
                  <br />
                  Los productos existentes mantendrán el tipo como texto, pero no aparecerá en el selector al crear nuevos productos.
                </>
              ) : (
                'Esta acción no se puede deshacer. Se eliminará permanentemente este tipo.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteType} 
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Quality Confirmation */}
      <AlertDialog open={!!deletingQuality} onOpenChange={() => setDeletingQuality(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {qualityUsageCount > 0 && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              ¿Eliminar calidad &quot;{deletingQuality?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {qualityUsageCount > 0 ? (
                <>
                  <span className="text-yellow-600 font-medium">
                    Hay {qualityUsageCount} producto{qualityUsageCount > 1 ? 's' : ''} usando esta calidad.
                  </span>
                  <br />
                  Los productos existentes mantendrán la calidad como texto, pero no aparecerá en el selector al crear nuevos productos.
                </>
              ) : (
                'Esta acción no se puede deshacer. Se eliminará permanentemente esta calidad.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteQuality} 
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
