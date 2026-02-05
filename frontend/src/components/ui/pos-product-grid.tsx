'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Product } from '@/hooks/use-products-supabase';

// Helper types
type ViewState = 'FAMILY' | 'TYPE' | 'QUALITY';

interface PosProductGridProps {
  products: Product[];
  onSelect: (productId: number) => void;
  selectedProductId?: number | null;
}

export function PosProductGrid({ products, onSelect, selectedProductId }: PosProductGridProps) {
  const [view, setView] = useState<ViewState>('FAMILY');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Sync internal state if selectedProductId changes externally
  useEffect(() => {
     if (selectedProductId) {
        const product = products.find(p => p.id === selectedProductId);
        if (product) {
            setSelectedFamily(product.name);
            setSelectedType(product.type);
        }
     } else {
        // Optional: Reset if cleared
     }
  }, [selectedProductId, products]);

  // Derived Data
  const productFamilies = useMemo(() => {
    const families = new Set(products.map(p => p.name));
    return Array.from(families).sort();
  }, [products]);

  const familyTypes = useMemo(() => {
    if (!selectedFamily) return [];
    const types = new Set(products.filter(p => p.name === selectedFamily).map(p => p.type));
    return Array.from(types).sort();
  }, [products, selectedFamily]);

  const typeQualities = useMemo(() => {
    if (!selectedFamily || !selectedType) return [];
    return products.filter(p => p.name === selectedFamily && p.type === selectedType);
  }, [products, selectedFamily, selectedType]);

  // Handlers
  const handleFamilySelect = (fam: string) => {
    setSelectedFamily(fam);
    // Auto-advance check
    const relatedProducts = products.filter(p => p.name === fam);
    const uniqueTypes = new Set(relatedProducts.map(p => p.type));
    
    if (uniqueTypes.size === 1) {
        // Skip Type selection if only one type exists
        const type = Array.from(uniqueTypes)[0];
        handleTypeSelect(type);
    } else {
        setView('TYPE');
    }
  };

  const handleTypeSelect = (type: string) => {
      setSelectedType(type);
      setView('QUALITY');
  };

  const handleFinalSelect = (id: number) => {
      onSelect(id);
      // We don't close here, the parent does.
  };

  const goHome = () => {
    setView('FAMILY');
    setSelectedFamily(null);
    setSelectedType(null);
  };

  const goType = () => {
      if (selectedFamily) setView('TYPE');
  };

  return (
    <div className="w-full">
        {/* Breadcrumbs */}
        <div className="mb-4 flex items-center gap-2 text-sm flex-wrap p-2 bg-gray-50 rounded-lg">
             <Button variant="ghost" size="sm" onClick={goHome} className={view === 'FAMILY' ? 'font-bold underline text-blue-600' : 'text-gray-500'}>
                🏠 Inicio
             </Button>
             
             {selectedFamily && (
                 <>
                    <span className="text-gray-300">/</span>
                    <Button variant="ghost" size="sm" onClick={goType} className={view === 'TYPE' ? 'font-bold underline text-blue-600' : 'text-gray-500'}>
                        {selectedFamily}
                    </Button>
                 </>
             )}
             
             {selectedType && (
                 <>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-900 font-medium px-2">{selectedType}</span>
                 </>
             )}
        </div>

        {/* GRIDS */}
        <div className="min-h-[300px]">
            {view === 'FAMILY' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-200">
                    {productFamilies.map(fam => (
                        <Button 
                            key={fam} 
                            variant="outline" 
                            className="h-24 text-lg font-bold whitespace-normal hover:border-blue-500 hover:bg-blue-50" 
                            onClick={() => handleFamilySelect(fam)}
                        >
                            {fam}
                        </Button>
                    ))}
                </div>
            )}
            
            {view === 'TYPE' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-right-4 duration-200">
                     {familyTypes.map(type => (
                        <Button 
                            key={type} 
                            variant="outline" 
                            className="h-24 text-lg font-bold whitespace-normal hover:border-blue-500 hover:bg-blue-50" 
                            onClick={() => handleTypeSelect(type)}
                        >
                            {type}
                        </Button>
                     ))}
                </div>
            )}

            {view === 'QUALITY' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    {typeQualities.map(prod => (
                        <Button 
                            key={prod.id} 
                            variant={selectedProductId === prod.id ? "default" : "outline"}
                            className={`h-24 flex flex-col items-center justify-center gap-1 ${selectedProductId === prod.id ? 'ring-2 ring-offset-2 ring-blue-600' : 'hover:border-blue-500'}`}
                            onClick={() => handleFinalSelect(prod.id)}
                        >
                            <span className="font-bold text-lg">{prod.quality}</span>
                            <span className="text-xs font-normal opacity-80">{prod.type}</span>
                        </Button>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
}
