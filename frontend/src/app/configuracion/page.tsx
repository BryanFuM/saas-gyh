'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Settings, Plus, Trash2, Tag, Star } from 'lucide-react';

interface ProductType {
  id: number;
  name: string;
}

interface ProductQuality {
  id: number;
  name: string;
}

export default function ConfiguracionPage() {
  const { token, user, isHydrated, hydrate } = useAuthStore();
  const { toast } = useToast();
  
  const [types, setTypes] = useState<ProductType[]>([]);
  const [qualities, setQualities] = useState<ProductQuality[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form state
  const [newType, setNewType] = useState('');
  const [newQuality, setNewQuality] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const [typesRes, qualitiesRes] = await Promise.all([
        fetch('/api/python/config/product-types', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/python/config/product-qualities', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      if (typesRes.ok) setTypes(await typesRes.json());
      if (qualitiesRes.ok) setQualities(await qualitiesRes.json());
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
      fetchData();
    } catch (error) {
      console.error('Error:', error);
    }
  };

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
      fetchData();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Acceso Restringido</p>
            <p className="text-gray-400 text-sm">Solo los administradores pueden acceder a la configuración</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-gray-500">Configura los tipos y calidades de productos</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Tipos de Producto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tipos de Producto
              </CardTitle>
              <CardDescription>
                Define los tipos de producto disponibles (ej: Kion, Cúrcuma)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Nuevo tipo..."
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addType()}
                />
                <Button onClick={addType}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {types.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay tipos definidos</p>
                ) : (
                  types.map((type) => (
                    <div key={type.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <span>{type.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => deleteType(type.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Calidades de Producto */}
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
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Nueva calidad..."
                  value={newQuality}
                  onChange={(e) => setNewQuality(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addQuality()}
                />
                <Button onClick={addQuality}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {qualities.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay calidades definidas</p>
                ) : (
                  qualities.map((quality) => (
                    <div key={quality.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <span>{quality.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => deleteQuality(quality.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
