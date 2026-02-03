'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Auth con Supabase Authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: username, // Asumiendo que el "usuario" ingresa email, o hay que manejar login con username custom
        password: password,
      });

      if (authError) throw authError;
      if (!authData.session) throw new Error('No se pudo establecer la sesión');

      // 2. Obtener Rol desde tabla profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', authData.user?.id)
        .single();

      // Si no hay perfil (legacy user?), fallback o error
      const userRole = profile?.role || 'VENDEDOR';
      const userName = profile?.username || authData.user?.email || 'Usuario';

      // 3. Crear token compatible con el store actual (Bridge)
      // Usamos el access_token de Supabase como nuestro token
      setAuth({ 
        id: authData.user!.id,
        username: userName, 
        role: userRole 
      }, authData.session.access_token);
      
      toast({
        title: "Bienvenido",
        description: `Sesión iniciada como ${userRole}`,
      });

      router.push('/');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: error.message === 'Invalid login credentials' 
          ? 'Credenciales incorrectas' 
          : (error.message || "Ocurrió un error al iniciar sesión"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl md:text-2xl font-bold text-center">Agroinversiones Beto</CardTitle>
          <CardDescription className="text-center text-sm">Control de Inventario y Ventas</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 p-4 md:p-6 pt-0 md:pt-0">
            <div className="space-y-2">
              <Label htmlFor="username">Correo Electrónico</Label>
              <Input 
                id="username" 
                type="email" 
                placeholder="admin@ejemplo.com" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Entrar"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
