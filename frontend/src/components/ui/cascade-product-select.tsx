"use client"

import * as React from "react"
import { Check, ChevronsUpDown, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import type { Product, StockInfo } from "@/lib/types"

// Productos que NO tienen variantes (selector 2 se oculta)
const PRODUCTS_WITHOUT_VARIANTS = ['Coco', 'Zapallo', 'Palillo'];

interface CascadeProductSelectProps {
  products: Product[];
  stockMap: Record<number, number>; // product_id -> stock_javas
  value: number | null;
  onSelect: (productId: number | null) => void;
  disabled?: boolean;
  showStockWarning?: boolean; // Mostrar advertencia de stock negativo
}

/**
 * Selector de productos en cascada:
 * Select 1: Producto (Kion, Zapallo, Coco...)
 * Select 2: Calidad/Variante (filtrado según Select 1)
 * 
 * Nota: Coco, Zapallo y Palillo no tienen variantes (Select 2 oculto)
 */
export function CascadeProductSelect({
  products,
  stockMap,
  value,
  onSelect,
  disabled = false,
  showStockWarning = true,
}: CascadeProductSelectProps) {
  const [productNameOpen, setProductNameOpen] = React.useState(false);
  const [variantOpen, setVariantOpen] = React.useState(false);
  const [selectedProductName, setSelectedProductName] = React.useState<string | null>(null);

  // Obtener nombres únicos de productos
  const productNames = React.useMemo(() => {
    const names = Array.from(new Set(products.map(p => p.name)));
    return names.sort();
  }, [products]);

  // Filtrar variantes según producto seleccionado
  const variants = React.useMemo(() => {
    if (!selectedProductName) return [];
    return products
      .filter(p => p.name === selectedProductName)
      .sort((a, b) => `${a.type}-${a.quality}`.localeCompare(`${b.type}-${b.quality}`));
  }, [products, selectedProductName]);

  // Verificar si el producto actual tiene variantes
  const hasVariants = React.useMemo(() => {
    return selectedProductName && !PRODUCTS_WITHOUT_VARIANTS.includes(selectedProductName);
  }, [selectedProductName]);

  // Producto seleccionado actual
  const selectedProduct = React.useMemo(() => {
    if (!value) return null;
    return products.find(p => p.id === value);
  }, [products, value]);

  // Stock del producto seleccionado
  const currentStock = React.useMemo(() => {
    if (!value) return 0;
    return stockMap[value] || 0;
  }, [stockMap, value]);

  // Sincronizar estado cuando cambia el valor externo
  React.useEffect(() => {
    if (selectedProduct) {
      setSelectedProductName(selectedProduct.name);
    }
  }, [selectedProduct]);

  // Manejar selección de nombre de producto
  const handleProductNameSelect = (name: string | null) => {
    setSelectedProductName(name);
    setProductNameOpen(false);
    
    if (!name) {
      onSelect(null);
      return;
    }

    // Si el producto no tiene variantes, seleccionar automáticamente
    if (PRODUCTS_WITHOUT_VARIANTS.includes(name)) {
      const product = products.find(p => p.name === name);
      if (product) {
        onSelect(product.id);
      }
    } else {
      // Limpiar selección si cambia el producto base
      if (selectedProduct?.name !== name) {
        onSelect(null);
      }
    }
  };

  // Manejar selección de variante
  const handleVariantSelect = (productId: number | null) => {
    onSelect(productId);
    setVariantOpen(false);
  };

  // Obtener stock para mostrar en dropdown
  const getStockDisplay = (productId: number) => {
    const stock = stockMap[productId] || 0;
    const isNegative = stock < 0;
    return {
      value: stock,
      display: `${stock.toFixed(2)} javas`,
      isNegative,
      className: isNegative ? 'text-red-500 font-medium' : 'text-muted-foreground'
    };
  };

  return (
    <div className="space-y-3">
      {/* Select 1: Producto */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Producto</Label>
        <Popover open={productNameOpen} onOpenChange={setProductNameOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={productNameOpen}
              disabled={disabled}
              className="w-full justify-between"
            >
              <span className="truncate">
                {selectedProductName || "Seleccionar producto..."}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Buscar producto..." />
              <CommandList>
                <CommandEmpty>No se encontró el producto.</CommandEmpty>
                <CommandGroup>
                  {productNames.map((name) => (
                    <CommandItem
                      key={name}
                      value={name}
                      onSelect={() => handleProductNameSelect(name === selectedProductName ? null : name)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedProductName === name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{name}</span>
                      {PRODUCTS_WITHOUT_VARIANTS.includes(name) && (
                        <span className="ml-2 text-xs text-muted-foreground">(sin variantes)</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Select 2: Calidad/Variante (solo si tiene variantes) */}
      {hasVariants && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Calidad / Variante</Label>
          <Popover open={variantOpen} onOpenChange={setVariantOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={variantOpen}
                disabled={disabled || !selectedProductName}
                className="w-full justify-between"
              >
                <span className="truncate">
                  {selectedProduct 
                    ? `${selectedProduct.type} - ${selectedProduct.quality}`
                    : "Seleccionar variante..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0">
              <Command>
                <CommandInput placeholder="Buscar variante..." />
                <CommandList>
                  <CommandEmpty>No se encontraron variantes.</CommandEmpty>
                  <CommandGroup>
                    {variants.map((variant) => {
                      const stockInfo = getStockDisplay(variant.id);
                      return (
                        <CommandItem
                          key={variant.id}
                          value={`${variant.type}-${variant.quality}`}
                          onSelect={() => handleVariantSelect(variant.id === value ? null : variant.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === variant.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col flex-1">
                            <span className="font-medium">
                              {variant.type} - {variant.quality}
                            </span>
                            <span className={cn("text-xs", stockInfo.className)}>
                              Stock: {stockInfo.display}
                              {stockInfo.isNegative && " ⚠️"}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Información de stock con advertencia visual */}
      {selectedProduct && showStockWarning && (
        <div className={cn(
          "flex items-center gap-2 text-xs p-2 rounded-md",
          currentStock < 0 
            ? "bg-red-50 text-red-700 border border-red-200" 
            : currentStock < 10 
              ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
              : "bg-green-50 text-green-700 border border-green-200"
        )}>
          {currentStock < 0 && <AlertCircle className="h-4 w-4" />}
          <span>
            Stock: <strong>{currentStock.toFixed(2)} javas</strong>
            {" "}({(currentStock * selectedProduct.conversion_factor).toFixed(1)} kg)
          </span>
          {currentStock < 0 && (
            <span className="ml-auto font-medium">Stock negativo</span>
          )}
        </div>
      )}
    </div>
  );
}

export default CascadeProductSelect;
