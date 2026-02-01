'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Settings, Building2, Users, Printer, Trash2, Edit2, Save, X, UserPlus, Phone, MessageSquare, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSystemUsers, useCreateUser, useDeleteUser } from '@/hooks/use-users-supabase';

interface BusinessSettings {
  company_name: string;
  phone: string;
  whatsapp: string;
  address: string;
}

export default function ConfiguracionPage() {
  const { user, isHydrated, hydrate } = useAuthStore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('negocio');
  
  // Users from Supabase
  const { data: users = [], isLoading: isLoadingUsers } = useSystemUsers();
  const createUserMutation = useCreateUser();
  const deleteUserMutation = useDeleteUser();
  
  // Business settings (stored in localStorage for MVP)
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    company_name: 'Agroinversiones Beto',
    phone: '',
    whatsapp: '',
    address: '',
  });
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [businessForm, setBusinessForm] = useState<BusinessSettings>({
    company_name: '',
    phone: '',
    whatsapp: '',
    address: '',
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  
  // New user form
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    role: 'VENDEDOR' as 'ADMIN' | 'VENDEDOR',
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    loadBusinessSettings();
  }, []);

  const loadBusinessSettings = () => {
    try {
      const saved = localStorage.getItem('agrobeto_business_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBusinessSettings(parsed);
        setBusinessForm(parsed);
      }
    } catch (error) {
      console.error('Error loading business settings:', error);
    }
    setIsLoadingSettings(false);
  };

  const saveBusinessSettings = () => {
    try {
      localStorage.setItem('agrobeto_business_settings', JSON.stringify(businessForm));
      setBusinessSettings(businessForm);
      setIsEditingBusiness(false);
      toast({ title: "Guardado", description: "Configuración del negocio actualizada" });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.username.trim() || !newUserForm.password.trim()) {
      toast({ title: "Error", description: "Usuario y contraseña son requeridos", variant: "destructive" });
      return;
    }
    
    try {
      await createUserMutation.mutateAsync(newUserForm);
      toast({ title: "Éxito", description: "Usuario creado correctamente" });
      setShowUserDialog(false);
      setNewUserForm({ username: '', password: '', role: 'VENDEDOR' });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    // Prevent deleting yourself
    if (user?.id === userId) {
      toast({ title: "Error", description: "No puedes eliminar tu propio usuario", variant: "destructive" });
      return;
    }

    try {
      await deleteUserMutation.mutateAsync(userId);
      toast({ title: "Eliminado", description: `Usuario ${username} eliminado` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Settings className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Configuración</h1>
          <p className="text-sm md:text-base text-gray-500">Administra tu negocio y usuarios</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="negocio" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Negocio</span>
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Usuarios</span>
          </TabsTrigger>
        </TabsList>

        {/* Business Settings Tab */}
        <TabsContent value="negocio">
          {isLoadingSettings ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Datos del Negocio
                      </CardTitle>
                      <CardDescription>
                        Información que aparece en tickets y documentos
                      </CardDescription>
                    </div>
                    {!isEditingBusiness ? (
                      <Button variant="outline" size="sm" onClick={() => {
                        setBusinessForm(businessSettings);
                        setIsEditingBusiness(true);
                      }}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsEditingBusiness(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={saveBusinessSettings}>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditingBusiness ? (
                    <>
                      <div className="space-y-2">
                        <Label>Nombre del Negocio</Label>
                        <Input
                          value={businessForm.company_name}
                          onChange={(e) => setBusinessForm({ ...businessForm, company_name: e.target.value })}
                          placeholder="Agroinversiones Beto"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Teléfono</Label>
                        <div className="flex gap-2">
                          <Phone className="h-4 w-4 mt-3 text-gray-400" />
                          <Input
                            value={businessForm.phone}
                            onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })}
                            placeholder="987 654 321"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>WhatsApp</Label>
                        <div className="flex gap-2">
                          <MessageSquare className="h-4 w-4 mt-3 text-green-500" />
                          <Input
                            value={businessForm.whatsapp}
                            onChange={(e) => setBusinessForm({ ...businessForm, whatsapp: e.target.value })}
                            placeholder="+51 987 654 321"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Dirección</Label>
                        <Input
                          value={businessForm.address}
                          onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                          placeholder="Av. Principal 123, Lima"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Nombre</p>
                        <p className="font-medium text-lg">{businessSettings.company_name || '-'}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Teléfono
                          </p>
                          <p className="font-medium">{businessSettings.phone || '-'}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-green-500" /> WhatsApp
                          </p>
                          <p className="font-medium">{businessSettings.whatsapp || '-'}</p>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Dirección</p>
                        <p className="font-medium">{businessSettings.address || '-'}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Printer className="h-5 w-5" />
                    Impresión
                  </CardTitle>
                  <CardDescription>
                    Configuración de tickets térmicos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700">
                      <strong>Próximamente:</strong> Configuración de impresora térmica, 
                      tamaño de papel y formato de tickets.
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm">Ancho de papel</span>
                      <span className="text-sm text-gray-500">80mm (estándar)</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm">Imprimir logo</span>
                      <span className="text-sm text-gray-500">No configurado</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm">Mensaje de pie</span>
                      <span className="text-sm text-gray-500">Gracias por su compra</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Usuarios del Sistema
                  </CardTitle>
                  <CardDescription>
                    Administra quién puede acceder al sistema
                  </CardDescription>
                </div>
                <Button onClick={() => setShowUserDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Nuevo Usuario
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : users.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay usuarios registrados</p>
              ) : (
                <div className="space-y-3">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${u.role === 'ADMIN' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                          {u.role === 'ADMIN' ? (
                            <ShieldCheck className="h-5 w-5 text-amber-600" />
                          ) : (
                            <Users className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{u.username}</p>
                          <p className="text-sm text-gray-500">{u.role === 'ADMIN' ? 'Administrador' : 'Vendedor'}</p>
                        </div>
                      </div>
                      {u.id !== user?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={deleteUserMutation.isPending}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará permanentemente el usuario <strong>{u.username}</strong>.
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-500 hover:bg-red-600"
                                onClick={() => handleDeleteUser(u.id, u.username)}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Crea una cuenta para un nuevo miembro del equipo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de Usuario</Label>
              <Input
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                placeholder="usuario123"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(value: 'ADMIN' | 'VENDEDOR') => setNewUserForm({ ...newUserForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Los vendedores solo pueden registrar ventas. Los administradores tienen acceso completo.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
