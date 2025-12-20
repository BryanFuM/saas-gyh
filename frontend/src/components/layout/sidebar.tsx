'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, UserRole } from '@/store/auth-store';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Truck, 
  Users, 
  BarChart3, 
  PackageSearch,
  LogOut,
  Package,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarItem {
  title: string;
  href: string;
  icon: any;
  roles: UserRole[];
}

const sidebarItems: SidebarItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'VENDEDOR', 'INVENTOR'],
  },
  {
    title: 'Productos',
    href: '/productos',
    icon: Package,
    roles: ['ADMIN', 'VENDEDOR', 'INVENTOR'],
  },
  {
    title: 'Ingreso Mercadería',
    href: '/ingresos',
    icon: Truck,
    roles: ['ADMIN', 'INVENTOR'],
  },
  {
    title: 'Ventas',
    href: '/ventas',
    icon: ShoppingCart,
    roles: ['ADMIN', 'VENDEDOR'],
  },
  {
    title: 'Gestión Pedidos',
    href: '/pedidos',
    icon: PackageSearch,
    roles: ['ADMIN', 'VENDEDOR'],
  },
  {
    title: 'Clientes',
    href: '/clientes',
    icon: Users,
    roles: ['ADMIN', 'VENDEDOR'],
  },
  {
    title: 'Reportes',
    href: '/reportes',
    icon: BarChart3,
    roles: ['ADMIN'],
  },
  {
    title: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    roles: ['ADMIN'],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Don't render anything until hydrated to avoid mismatch
  if (!isHydrated) return null;
  if (!user) return null;

  const filteredItems = sidebarItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex flex-col w-64 bg-white border-r h-screen">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">ByH App</h1>
        <p className="text-sm text-gray-500 mt-1">{user.username} ({user.role})</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.title}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={logout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}
