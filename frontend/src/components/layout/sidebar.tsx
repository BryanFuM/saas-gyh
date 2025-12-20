'use client';

import { useEffect, useState } from 'react';
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
  Settings,
  Menu,
  X
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Don't render anything until hydrated to avoid mismatch
  if (!isHydrated) return null;
  if (!user) return null;

  const filteredItems = sidebarItems.filter(item => item.roles.includes(user.role));

  const SidebarContent = () => (
    <>
      <div className="p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold text-primary">ByH App</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-1">{user.username} ({user.role})</p>
      </div>
      
      <nav className="flex-1 px-2 md:px-4 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center px-3 md:px-4 py-2.5 md:py-2 text-sm font-medium rounded-md transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
            <span className="truncate">{item.title}</span>
          </Link>
        ))}
      </nav>

      <div className="p-2 md:p-4 border-t">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={logout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary">ByH App</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={cn(
        "md:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-white border-r h-screen sticky top-0">
        <SidebarContent />
      </div>

      {/* Mobile Spacer */}
      <div className="md:hidden h-14" />
    </>
  );
}
