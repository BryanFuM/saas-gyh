import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agroinversiones Beto - Sistema de Inventario",
  description: "Sistema de gestión de inventario y ventas mayoristas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 overflow-y-auto w-full">
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
