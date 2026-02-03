'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Product } from '@/hooks/use-products-supabase';

interface CascadeProductSelectProps {
  products: Product[];
  selectedProductId: number | null;
  onSelect: (productId: number | null) => void;
  disabled?: boolean;
  currentStock?: number;
  stockWarning?: boolean;
}

export function CascadeProductSelect({
  products,
  selectedProductId,
  onSelect,
  disabled,
  currentStock,
  stockWarning
}: CascadeProductSelectProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  
  // Ref to track if the state change was internal (user interaction) or external (reset/prop change)
  const isInternalChange = useRef(false);

  // 1. Get Unique Names
  const uniqueNames = useMemo(() => {
    const names = new Set(products.map(p => p.name));
    return Array.from(names).sort();
  }, [products]);

  // 2. Get Types for selected Name
  const availableTypes = useMemo(() => {
    if (!selectedName) return [];
    const types = new Set(
      products
        .filter(p => p.name === selectedName)
        .map(p => p.type)
    );
    return Array.from(types).sort();
  }, [products, selectedName]);

  // 3. Get Products (Qualities) for selected Name + Type
  const availableProducts = useMemo(() => {
    if (!selectedName) return [];
    // If we have a type, filter by it.
    if (!selectedType) {
        return [];
    }
    return products
      .filter(p => p.name === selectedName && p.type === selectedType)
      .sort((a, b) => a.quality.localeCompare(b.quality));
  }, [products, selectedName, selectedType]);

  const selectedProduct = useMemo(() => 
    products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // Sync state with value prop (selectedProductId)
  useEffect(() => {
    if (selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        setSelectedName(product.name);
        setSelectedType(product.type);
      }
    } else {
      // If external clear (not caused by our internal change), clear visual state
      if (!isInternalChange.current) {
        setSelectedName(null);
        setSelectedType(null);
      }
      // Reset flag
      isInternalChange.current = false;
    }
  }, [selectedProductId, products]);

  // Handle Name Change
  const handleNameChange = (name: string) => {
    isInternalChange.current = true;
    
    const types = new Set(products.filter(p => p.name === name).map(p => p.type));
    const typesArray = Array.from(types);
    const productsWithName = products.filter(p => p.name === name);

    // Auto-select logic
    if (productsWithName.length === 1) {
      const p = productsWithName[0];
      setSelectedName(name);
      setSelectedType(p.type);
      onSelect(p.id);
    } else if (typesArray.length === 1) {
      const type = typesArray[0];
      const productsOfType = products.filter(p => p.name === name && p.type === type);
      
      setSelectedName(name);
      setSelectedType(type);
      
      if (productsOfType.length === 1) {
        onSelect(productsOfType[0].id);
      } else {
        onSelect(null);
      }
    } else {
      setSelectedName(name);
      setSelectedType(null); // Reset type
      onSelect(null); // Reset ID
    }
  };

  // Handle Type Change
  const handleTypeChange = (type: string) => {
    isInternalChange.current = true;
    const productsOfType = products.filter(p => p.name === selectedName && p.type === type);

    setSelectedType(type);

    if (productsOfType.length === 1) {
      onSelect(productsOfType[0].id);
    } else {
      onSelect(null);
    }
  };

  // Handle Quality (Product) Change
  const handleQualityChange = (productIdStr: string) => {
    isInternalChange.current = true;
    onSelect(parseInt(productIdStr));
  };

  const showTypeDropdown = !!selectedName && availableTypes.length > 1;
  const showQualityDropdown = !!selectedName && !!selectedType && availableProducts.length > 1;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        {/* 1. Name */}
        <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Nombre</Label>
            <Select 
                value={selectedName || ''} 
                onValueChange={handleNameChange}
                disabled={disabled}
            >
                <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                    {uniqueNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        {/* 2. Type */}
        {showTypeDropdown && (
            <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Tipo</Label>
                <Select 
                    value={selectedType || ''} 
                    onValueChange={handleTypeChange}
                    disabled={disabled}
                >
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )}

        {/* 3. Quality */}
        {showQualityDropdown && (
            <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Calidad</Label>
                <Select 
                    value={selectedProductId?.toString() || ''} 
                    onValueChange={handleQualityChange}
                    disabled={disabled}
                >
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleccionar calidad..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableProducts.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                                {p.quality}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )}
      </div>

      {/* Blue Summary Card (Standardized) */}
      {selectedProduct && (
        <div className="mt-4">
          <div className="bg-blue-50 border border-blue-100 rounded-md p-3 flex items-start gap-3 shadow-sm">
             <div className="bg-blue-100 p-2 rounded-full">
               <Package className="h-5 w-5 text-blue-600" />
             </div>
             <div>
               <p className="text-sm font-semibold text-blue-900 leading-tight">
                  {selectedProduct.name}
                  {selectedProduct.type && selectedProduct.type !== 'Sin Variedad' && (
                    <span className="text-blue-700"> - {selectedProduct.type}</span>
                  )}
                  {selectedProduct.quality && selectedProduct.quality !== 'Sin Clasificar' && (
                    <span className="text-blue-600 font-normal ml-1">({selectedProduct.quality})</span>
                  )}
               </p>
               {currentStock !== undefined && (
                 <p className={`text-xs mt-1 font-medium ${stockWarning ? 'text-yellow-700' : 'text-slate-500'}`}>
                   {stockWarning && <AlertTriangle className="h-3 w-3 inline mr-1 -mt-0.5" />}
                   Stock actual: {currentStock.toFixed(2)} javas
                 </p>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}


