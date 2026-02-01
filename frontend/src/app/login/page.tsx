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
      // Buscar usuario en Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, password_hash, role, is_active')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      if (error || !user) {
        throw new Error('Usuario no encontrado');
      }

      // Verificar contraseña (comparación simple para MVP)
      // En producción usar bcrypt o Supabase Auth
      if (user.password_hash !== password) {
        throw new Error('Contraseña incorrecta');
      }

      // Crear token simple (en producción usar JWT o Supabase Auth)
      const token = btoa(JSON.stringify({ 
        id: user.id, 
        username: user.username, 
        role: user.role,
        exp: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
      }));

      setAuth({ 
        id: user.id,
        username: user.username, 
        role: user.role 
      }, token);
      
      toast({
        title: "Bienvenido",
        description: `Sesión iniciada como ${user.role}`,
      });

      router.push('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Ocurrió un error al iniciar sesión",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl md:text-2xl font-bold text-center">Agroinversiones Beto - Inventario</CardTitle>
          <CardDescription className="text-center text-sm">Ingresa tus credenciales para continuar</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 p-4 md:p-6 pt-0 md:pt-0">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="admin" 
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
