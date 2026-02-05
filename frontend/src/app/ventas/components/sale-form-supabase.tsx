'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CascadeProductSelect } from '@/components/ui/cascade-product-select';
import { ClientSelect } from '@/components/ui/searchable-select';
import { Plus, Trash2, Printer, Save, Scale, UserPlus, AlertTriangle, User, ArrowLeft, Check, Box, Package, ShoppingCart } from 'lucide-react';
import { TicketTemplate } from './ticket-template';
import { useReactToPrint } from 'react-to-print';

// ✅ SUPABASE HOOKS (Adiós mock data)
import { useProducts, useProductTypes } from '@/hooks/use-products-supabase';
import { useClients, useCreateClient } from '@/hooks/use-clients-supabase';
import { useStock } from '@/hooks/use-stock-supabase';
import { useCreateVenta, useUpdateVenta, type Venta } from '@/hooks/use-ventas-supabase';
import { useAuthStore } from '@/store/auth-store';

interface SaleItem {
  id: string;
  product_name: string | null;   // Paso 1: Nombre del producto (Kion, Manzana, etc.)
  product_type: string | null;   // Paso 2: Tipo específico dentro del nombre
  product_id: number | null;     // Paso 3: Producto específico (con calidad)
  quantity_kg: string;
  quantity_javas: string;        // 🆕 Javas explícitas
  price_per_kg: string;
  hasStockWarning: boolean;      // ⚠️ Stock insuficiente
}

const createEmptyItem = (): SaleItem => ({
  id: crypto.randomUUID(),
  product_name: null,
  product_type: null,
  product_id: null,
  quantity_kg: '',
  quantity_javas: '', // 🆕 Inicialmente vacío, se calculará al poner Kilos
  price_per_kg: '',
  hasStockWarning: false,
});

/**
 * Parse a numeric string, removing leading zeros except for decimals.
 */
const parseNumericInput = (value: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/^0+(?=\d)/, '');
  if (value === '0' || cleaned === '') return value === '0' ? '0' : '';
  return cleaned;
};

export function SaleFormSupabase({ onSuccess, initialData }: { onSuccess: () => void, initialData?: Venta }) {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  
  // ✅ React Query hooks conectados a Supabase
  const { data: products = [] } = useProducts();
  const { data: productTypes = [] } = useProductTypes();
  const { data: clients = [], refetch: refetchClients } = useClients();
  const { data: stock } = useStock();
  const createVenta = useCreateVenta();
  const updateVenta = useUpdateVenta();
  const createClientMutation = useCreateClient();
  
  // Helper to map DB items to UI items
  const mapInitialItems = (): SaleItem[] => {
    if (!initialData?.items || initialData.items.length === 0) {
      return [createEmptyItem()];
    }
    return initialData.items.map(item => ({
      id: crypto.randomUUID(),
      product_name: null, // Will be filled by CascadeProductSelect logic if needed, but we rely on product_id
      product_type: null,
      product_id: item.product_id,
      quantity_kg: item.quantity_kg.toString(),
      quantity_javas: item.quantity_javas.toString(), // 🆕 Recuperar del backend
      price_per_kg: item.price_per_kg.toString(),
      hasStockWarning: false 
    }));
  };

  // Form state
  const [mode, setMode] = useState<'CAJA' | 'PEDIDO'>(
    initialData ? (initialData.type as 'CAJA' | 'PEDIDO') : 'CAJA'
  );
  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    initialData?.client_id || null
  );
  const [guestClientName, setGuestClientName] = useState(
    initialData?.guest_client_name || ''
  );  // 🆕 Cliente eventual
  
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA'>(
    (initialData?.payment_method as any) || 'EFECTIVO'
  );
  
  const [amortization, setAmortization] = useState(
    initialData?.amortization ? initialData.amortization.toString() : ''
  );
  
  const [amortizationMethod, setAmortizationMethod] = useState<'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA'>(
    initialData?.type === 'PEDIDO' && initialData?.payment_method !== 'CREDITO' 
      ? (initialData.payment_method as any) 
      : 'EFECTIVO'
  ); // 🆕 Método para amortización
  
  const [items, setItems] = useState<SaleItem[]>(initialData ? mapInitialItems() : []);
  // 🆕 POS STATE (3 LEVELS: FAMILY -> TYPE -> QUALITY)
  const [currentItem, setCurrentItem] = useState<SaleItem>(createEmptyItem());
  const [posView, setPosView] = useState<'FAMILY' | 'TYPE' | 'QUALITY'>('FAMILY');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  
  const kgInputRef = useRef<HTMLInputElement>(null);

  const [lastSale, setLastSale] = useState<any>(null);
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [shouldPrintAfterSave, setShouldPrintAfterSave] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');
  
  const ticketRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: ticketRef });

  // Create stock map for quick lookup
  const stockMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (stock) {
      stock.forEach((s) => {
        map[s.product_id] = s.stock_javas;
      });
    }
    return map;
  }, [stock]);

  const selectedClient = useMemo(() => 
    clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const getProductById = (productId: number | null) => {
    if (!productId) return undefined;
    return products.find((p) => p.id === productId);
  };

  const getStockForProduct = (productId: number | null): number => {
    if (!productId) return 0;
    return stockMap[productId] || 0;
  };

  // Calculate item values
  const calculateItemValues = useCallback((item: SaleItem) => {
    const quantityKg = parseFloat(item.quantity_kg) || 0;
    const pricePerKg = parseFloat(item.price_per_kg) || 0;
    // 🆕 Usar valor explícito si existe, sino 0 (no autocalculamos aquí para visualización, confiamos en el input)
    const quantityJavas = parseFloat(item.quantity_javas) || 0; 
    
    const product = getProductById(item.product_id);
    const conversionFactor = product?.conversion_factor || 17;  // Default 17 kg/java
    
    const subtotal = quantityKg * pricePerKg;
    
    return { quantityKg, quantityJavas, pricePerKg, subtotal, conversionFactor };
  }, [products]); // getProductById is stable or not needed in dependency if products is there.
  // Actually getProductById is defined inside component. It depends on 'products'.
  // 'products' is in dependency array.
  // Ideally we should include getProductById but then we need to wrap getProductById in useCallback or move it out.
  // Simpler fix: Just leave [products] and ignore warning OR move getProductById to useCallback.
  // Let's wrap getProductById in useCallback above.


  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const values = calculateItemValues(item);
        return {
          kg: acc.kg + values.quantityKg,
          javas: acc.javas + values.quantityJavas,
          amount: acc.amount + values.subtotal,
        };
      },
      { kg: 0, javas: 0, amount: 0 }
    );
  }, [items, calculateItemValues]);

  // Check for stock warnings
  const hasAnyStockWarning = useMemo(() => 
    items.some(item => item.hasStockWarning),
    [items]
  );

  // ==========================================
  // ⚡ POS LOGIC (DRILL DOWN & INPUTS - 3 LEVEL)
  // ==========================================
  
  // 1. Get Unique Families (Level 1)
  const productFamilies = useMemo(() => {
    const families = new Set(products.map(p => p.name));
    return Array.from(families).sort();
  }, [products]);

  // 2. Get Unique Types for Selected Family (Level 2)
  const familyTypes = useMemo(() => {
    if (!selectedFamily) return [];
    const types = new Set(
        products
        .filter(p => p.name === selectedFamily)
        .map(p => p.type)
    );
    return Array.from(types).sort();
  }, [products, selectedFamily]);

  // 3. Get Qualities for Selected Family + Type (Level 3)
  const typeQualities = useMemo(() => {
     if (!selectedFamily || !selectedType) return [];
     return products.filter(p => p.name === selectedFamily && p.type === selectedType);
  }, [products, selectedFamily, selectedType]);

  const updateCurrentItem = (updates: Partial<SaleItem>) => {
    setCurrentItem(prev => ({ ...prev, ...updates }));
  };

  // STEP 1: Select Family
  const handleFamilySelect = (familyName: string) => {
    setSelectedFamily(familyName);
    
    // Check next Step (Types)
    const availableProducts = products.filter(p => p.name === familyName);
    const uniqueTypes = new Set(availableProducts.map(p => p.type));

    if (uniqueTypes.size === 1) {
        // Auto-select Type if only one
        handleTypeSelect(Array.from(uniqueTypes)[0]);
    } else {
        setPosView('TYPE');
    }
  };

  // STEP 2: Select Type
  const handleTypeSelect = (typeName: string) => {
      setSelectedType(typeName);

      // Check next step (Qualities)
      // Note: typeQualities memo depends on state, so we calculate locally here for immediate logic
      const availableVariants = products.filter(p => p.name === selectedFamily && p.type === typeName);
      
      if (availableVariants.length === 1) {
          // Auto-select product if only one quality
          handleFinalProductSelect(availableVariants[0].id);
      } else {
          setPosView('QUALITY');
      }
  };

  // STEP 3: Final Select (Quality -> Product ID)
  const handleFinalProductSelect = (productId: number) => {
    // Set Product
    const product = products.find(p => p.id === productId);
    const updates: Partial<SaleItem> = { product_id: productId, hasStockWarning: false };

    // Auto-Calculate Javas if KG exists
    if (product && currentItem.quantity_kg) {
        const factor = product.conversion_factor || 17;
        const kg = parseFloat(currentItem.quantity_kg);
        updates.quantity_javas = (kg / factor).toFixed(2);
    }

    updateCurrentItem(updates);

    // Focus Input
    setTimeout(() => {
        kgInputRef.current?.focus();
    }, 50);
  };
    
  // Breadcrumb Navigation
  const goHome = () => {
      setPosView('FAMILY');
      setSelectedFamily(null);
      setSelectedType(null);
  };

  const goType = () => {
      if (selectedFamily) {
        setPosView('TYPE');
        setSelectedType(null);
      }
  };


  // Handle numeric input for CURRENT ITEM (Bidirectional)
  const handleCurrentNumericInput = (field: 'quantity_kg' | 'price_per_kg' | 'quantity_javas', value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const cleaned = parseNumericInput(value);
      const updates: Partial<SaleItem> = { [field]: cleaned };
      
      const product = getProductById(currentItem.product_id);
      const conversionFactor = product?.conversion_factor || 17;

      // Bidirectional Logic
      if (field === 'quantity_kg') {
          if (cleaned) {
             updates.quantity_javas = (parseFloat(cleaned) / conversionFactor).toFixed(2);
          } else {
             updates.quantity_javas = '';
          }
      } else if (field === 'quantity_javas') {
           if (cleaned) {
              updates.quantity_kg = (parseFloat(cleaned) * conversionFactor).toFixed(2);
           } else {
              updates.quantity_kg = '';
           }
      }

      // Check Stock Warning immediatately for UI feedback
      if (product) {
         const javasToCheck = field === 'quantity_javas' 
             ? parseFloat(cleaned) 
             : (updates.quantity_javas ? parseFloat(updates.quantity_javas) : 0);
         
         const stock = getStockForProduct(product.id);
         updates.hasStockWarning = javasToCheck > stock;
      }

      updateCurrentItem(updates);
    }
  };

  const handleAddItemToCart = () => {
      if (!currentItem.product_id) {
          toast({ variant: 'destructive', title: 'Falta Producto', description: 'Selecciona un producto primero.' });
          return;
      }
      if (!parseFloat(currentItem.quantity_kg) || parseFloat(currentItem.quantity_kg) <= 0) {
          toast({ variant: 'destructive', title: 'Cantidad Inválida', description: 'Ingresa un peso válido.' });
          kgInputRef.current?.focus();
          return;
      }
      if (!parseFloat(currentItem.price_per_kg) || parseFloat(currentItem.price_per_kg) <= 0) {
          toast({ variant: 'destructive', title: 'Precio Inválido', description: 'Ingresa un precio válido.' });
          return;
      }
      
      setItems(prev => [...prev, { ...currentItem, id: crypto.randomUUID() }]);
      
      // Reset but keep some context? No, full reset for next item
      setCurrentItem(createEmptyItem());
      goHome();
      
      toast({ title: 'Agregado', description: 'Producto agregado a la lista.' });
  };


  const addItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<SaleItem>) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  // 🆕 Handle product selection and check stock
  const handleProductChange = (index: number, productId: number | null) => {
    // Si ya había kilos, recalcular javas con el factor del nuevo producto
    let updates: Partial<SaleItem> = { product_id: productId, hasStockWarning: false };
    
    if (productId && items[index].quantity_kg) {
        const product = products.find(p => p.id === productId);
        if (product) {
            const factor = product.conversion_factor || 17;
            const kg = parseFloat(items[index].quantity_kg);
            updates.quantity_javas = (kg / factor).toFixed(2);
        }
    }
    
    updateItem(index, updates);
  };

  // Handle numeric input with proper formatting
  const handleNumericInput = (index: number, field: 'quantity_kg' | 'price_per_kg' | 'quantity_javas', value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const cleaned = parseNumericInput(value);
      
      // Update the changed field
      const updates: Partial<SaleItem> = { [field]: cleaned };
      
      // 🧠 LOGICA INTELIGENTE:
      // 1. Si cambiamos KG -> Sugerir Javas (autocalcular)
      if (field === 'quantity_kg') {
          const item = items[index];
          const product = getProductById(item.product_id);
          
          if (product && cleaned) {
             const conversionFactor = product.conversion_factor || 17;
             // Auto-suggest javas derived from KG
             const suggestedJavas = (parseFloat(cleaned) / conversionFactor).toFixed(2);
             // Solo actualizamos javas si el usuario no lo ha escrito manualmente (o simple overwrite strategy)
             // Estrategia simplificada: Overwrite Javas when KG changes to keep them in sync by default
             updates.quantity_javas = suggestedJavas;
          }
      }
      
      // 2. Si cambiamos Javas -> NO TOCAMOS KG (Desvinculación intencional)
      // (El usuario está corrigiendo manualmente las javas reales)
      
      updateItem(index, updates);
      
      // 🆕 Check stock when quantity (javas) changes
      if (field === 'quantity_kg' || field === 'quantity_javas') {
        // Necesitamos el estado "futuro" para validar
        // Usamos setTimeout para no bloquear el render actual o recalculamos con el valor nuevo
        // Aproximación: recalcular con 'cleaned' y el resto del estado
        const item = items[index];
        const javasToCheck = field === 'quantity_javas' 
             ? parseFloat(cleaned) 
             : (updates.quantity_javas ? parseFloat(updates.quantity_javas) : 0);
             
        if (item.product_id) {
          const stockAvailable = getStockForProduct(item.product_id);
          
          if (javasToCheck > stockAvailable) {
             updateItem(index, { ...updates, hasStockWarning: true });
          } else {
             updateItem(index, { ...updates, hasStockWarning: false });
          }
        }
      }
    }
  };

  const resetForm = () => {
    setSelectedClientId(null);
    setGuestClientName('');
    setAmortization('');
    setItems([createEmptyItem()]);
    setLastSale(null);
    setShouldPrintAfterSave(false);
  };

  // 🆕 Validation without stock blocking
  const validateSale = (): string | null => {
    // 🛡️ Validación básica de carrito vacío
    if (items.length === 0) {
      return 'Agrega al menos un producto a la venta';
    }

    // Verificar si el único item está vacío (cuando se inicializa con createEmptyItem)
    if (items.length === 1 && !items[0].product_id) {
        return 'Agrega al menos un producto a la venta';
    }

    // En modo PEDIDO, cliente obligatorio
    if (mode === 'PEDIDO' && !selectedClientId) {
      return 'Selecciona un cliente para el pedido';
    }

    // 🛡️ Bug fix: Validación de amortización
    if (mode === 'PEDIDO') {
      const amort = parseFloat(amortization) || 0;
      const totalAmount = Number(totals.amount.toFixed(2));
      
      // Permitimos margen de error de 0.01 por punto flotante
      if (amort > totalAmount + 0.01) {
        return `La amortización (S/ ${amort.toFixed(2)}) no puede ser mayor al total (S/ ${totalAmount})`;
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) {
        // Skip empty placeholder items if we have others or handle properly
        // Actually items shouldn't contain empty items ideally if we use "Add to Cart" logic.
        // But `mapInitialItems` creates one empty item if nothing exists.
        // And `resetForm` does too.
        // If we are validating for save, we must ensure valid items.
        // If it's a "ghost" item at the end intended for input, ignore it?
        // But here items are 'added' items. The input area is 'currentItem'.
        // Wait, mapInitialItems returns [createEmptyItem()].
        // If user hasn't added anything, items=[placeholder].
        // So checking item.product_id fails.
        return `Producto ${i + 1}: Selecciona un producto o elimínalo`;
      }
      
      const values = calculateItemValues(item);
      if (values.quantityKg <= 0) {
        return `Producto ${i + 1}: Ingresa la cantidad en KG`;
      }
      if (values.pricePerKg <= 0) {
        return `Producto ${i + 1}: Ingresa el precio por KG`;
      }
      
      // ❌ ELIMINADO: Bloqueo por stock insuficiente
      // Ahora solo se muestra warning, no se bloquea
    }

    return null;
  };

  const handleShowConfirmation = (shouldPrint: boolean) => {
    const error = validateSale();
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error });
      return;
    }
    setShouldPrintAfterSave(shouldPrint);
    setShowConfirmModal(true);
  };

  // ✅ Submit using Supabase RPC
  const handleConfirmedSubmit = async () => {
    setShowConfirmModal(false);
    
    if (!user?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Usuario no autenticado' });
      return;
    }

    const ventaItems = items.map(item => ({
      product_id: item.product_id!,
      quantity_kg: parseFloat(item.quantity_kg),
      quantity_javas: parseFloat(item.quantity_javas) || 0, // 🆕 ENVIAMOS JAVAS EXPLÍCITAS
      price_per_kg: parseFloat(item.price_per_kg),
    }));

    // Determinar el método de pago real
    // Si es CAJA: usa paymentMethod (pago completo)
    // Si es PEDIDO y hay amortización: usa amortizationMethod (pago parcial)
    // Si es PEDIDO y NO hay amortización: se va como CREDITO
    const finalPaymentMethod: 'EFECTIVO' | 'YAPE' | 'CREDITO' | 'PLIN' | 'TRANSFERENCIA' = mode === 'CAJA' 
      ? paymentMethod 
      : (parseFloat(amortization) > 0 ? amortizationMethod : 'CREDITO');

    const commonData = {
        type: mode,
        client_id: mode === 'PEDIDO' ? selectedClientId : null,
        guest_client_name: mode === 'CAJA' ? (guestClientName.trim() || null) : null,
        user_id: user.id,
        payment_method: finalPaymentMethod,
        amortization: mode === 'PEDIDO' ? Math.min(parseFloat(amortization) || 0, Number(totals.amount.toFixed(2))) : 0,
        items: ventaItems,
    };

    try {
      let result;
      if (initialData) {
        result = await updateVenta.mutateAsync({
          venta_id: initialData.id,
          ...commonData
        });
      } else {
        result = await createVenta.mutateAsync(commonData);
      }

      // 🛠️ Construct full sale object for printing immediately
      const fullSaleData = {
         id: result.venta_id,
         date: new Date().toISOString(),
         type: mode,
         total_amount: result.total_amount || totals.amount,
         previous_debt: (result as any).previous_debt,
         new_debt: (result as any).new_debt,
         payment_method: finalPaymentMethod,
         client: mode === 'PEDIDO' ? selectedClient : null,
         guest_client_name: mode === 'CAJA' ? (guestClientName || 'Cliente Eventual') : null,
         items: items.map(item => {
            const product = getProductById(item.product_id);
            const vals = calculateItemValues(item);
            return {
                product_id: item.product_id,
                product_name: product?.name || 'Producto',
                product_type: product?.type,
                product_quality: product?.quality,
                quantity_javas: vals.quantityJavas,
                unit_sale_price: vals.pricePerKg * vals.conversionFactor, // Approximate java price or just display what we have
                // TicketTemplate uses unit_sale_price but our item has price_per_kg.
                // Let's pass enough info for the template to decide.
                price_per_kg: vals.pricePerKg,
                subtotal: vals.subtotal,
                products: product // Nested for template compatibility
            };
         })
      };

      setLastSale(fullSaleData);
      
      toast({
        title: initialData ? '✅ Actualización Exitosa' : '✅ Venta Exitosa',
        description: `Venta #${result.venta_id} ${initialData ? 'actualizada' : 'registrada'}. Total: S/ ${(result.total_amount || totals.amount).toFixed(2)}`,
        action: (
            <ToastAction altText="Imprimir Ticket" onClick={() => {
                // We need to wait for state to settle? 
                // handlePrint reads the ref. The ref content depends on setLastSale.
                // React batching might delay it. But typically fine for user click.
                // If auto-print logic runs, it uses setTimeout.
                setTimeout(() => handlePrint(), 100);
            }}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
            </ToastAction>
        )
      });

      if (shouldPrintAfterSave) {
        setTimeout(() => handlePrint(), 500);
      }

      onSuccess();
      resetForm();
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Error al guardar', 
        description: error.message 
      });
    }
  };

  const createNewClient = async () => {
    if (!newClientName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre es requerido' });
      return;
    }
    
    try {
      const newClient = await createClientMutation.mutateAsync({
        name: newClientName.trim(),
        whatsapp_number: newClientWhatsapp.trim() || undefined,
      });
      
      await refetchClients();
      setSelectedClientId(newClient.id);
      
      toast({ title: '✅ Éxito', description: `Cliente "${newClientName}" creado` });
      setShowNewClientModal(false);
      setNewClientName('');
      setNewClientWhatsapp('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'CAJA' | 'PEDIDO')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="CAJA" className="text-xs md:text-sm">💵 Caja (Contado)</TabsTrigger>
          <TabsTrigger value="PEDIDO" className="text-xs md:text-sm">📋 Pedido (Crédito)</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <span className="text-lg md:text-xl">Nueva Venta - {mode}</span>
              {mode === 'PEDIDO' && selectedClient && (
                <Badge variant="destructive" className="text-sm md:text-lg px-3 py-1 w-fit">
                  Deuda: S/ {Number(selectedClient.current_debt).toFixed(2)}
                </Badge>
              )}
              {hasAnyStockWarning && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Stock Insuficiente
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
            {/* ===== SECCIÓN CLIENTE ===== */}
            {mode === 'PEDIDO' ? (
              // PEDIDO: Cliente obligatorio
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Cliente *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewClientModal(true)}
                    className="text-primary h-8"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Nuevo Cliente
                  </Button>
                </div>
                <ClientSelect
                  clients={clients.map(c => ({
                    ...c,
                    whatsapp_number: c.whatsapp_number ?? undefined
                  }))}
                  value={selectedClientId}
                  onSelect={setSelectedClientId}
                  disabled={createVenta.isPending}
                />
              </div>
            ) : (
              // 🆕 CAJA: Cliente OPCIONAL + Método de pago
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Cliente Eventual (Opcional)
                  </Label>
                  <Input
                    value={guestClientName}
                    onChange={(e) => setGuestClientName(e.target.value)}
                    placeholder="Nombre del cliente (para el ticket)"
                    disabled={createVenta.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Método de Pago</Label>
                  <Select 
                    value={paymentMethod} 
                    onValueChange={(v) => setPaymentMethod(v as 'EFECTIVO' | 'YAPE')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EFECTIVO">💵 Efectivo</SelectItem>
                      <SelectItem value="YAPE">📱 Yape</SelectItem>
                      <SelectItem value="PLIN">📱 Plin</SelectItem>
                      <SelectItem value="TRANSFERENCIA">🏦 Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Amortización (solo PEDIDO) */}
            {mode === 'PEDIDO' && selectedClient && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <div className="space-y-2">
                  <Label>Pago a cuenta (Amortización)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={amortization}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Permitir vacio o formato decimal
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setAmortization(val);
                          
                          // Validación no bloqueante inmediata
                          const num = parseFloat(val);
                          const currentTotal = Number(totals.amount.toFixed(2));
                          
                          if (!isNaN(num) && num > currentTotal) {
                            toast({
                              variant: 'destructive',
                              title: 'Cuidado',
                              description: `El monto (S/ ${num}) supera el total (S/ ${currentTotal}). Ajusta el valor.`
                            });
                          }
                        }
                      }}
                      placeholder="0.00"
                      disabled={createVenta.isPending}
                    />
                    
                    {(parseFloat(amortization) > 0) && (
                      <div className="w-[180px]">
                        <Select 
                          value={amortizationMethod} 
                          onValueChange={(v) => setAmortizationMethod(v as any)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Medio de Pago" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EFECTIVO">💵 Efectivo</SelectItem>
                            <SelectItem value="YAPE">📱 Yape</SelectItem>
                            <SelectItem value="PLIN">📱 Plin</SelectItem>
                            <SelectItem value="TRANSFERENCIA">🏦 Transferencia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Si el cliente paga algo ahora, ingresa el monto aquí.
                  </p>
                </div>
              </div>
            )}

            {/* ===== SECCIÓN POS (NUEVA INTERFAZ) ===== */}
            <div className="space-y-6">
                
                {/* 1. SELECTOR DE PRODUCTOS (GRIDS) */}
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden p-4">
                     {/* BREADCRUMB NAVIGATION */}
                     <div className="mb-4 flex items-center gap-2 text-sm md:text-base flex-wrap">
                         <Button variant="ghost" size="sm" onClick={goHome} className={`px-2 ${posView === 'FAMILY' ? 'font-bold underline decoration-blue-500 underline-offset-4' : 'text-gray-500'}`}>
                            🏠 Inicio
                         </Button>
                         
                         {selectedFamily && (
                             <>
                                <span className="text-gray-300">/</span>
                                <Button variant="ghost" size="sm" onClick={goType} className={`px-2 ${posView === 'TYPE' ? 'font-bold underline decoration-blue-500 underline-offset-4' : 'text-gray-500'}`}>
                                    {selectedFamily}
                                </Button>
                             </>
                         )}

                        {selectedType && (
                             <>
                                <span className="text-gray-300">/</span>
                                <Button variant="ghost" size="sm" disabled className={`px-2 ${posView === 'QUALITY' ? 'font-bold underline decoration-blue-500 underline-offset-4' : 'text-gray-500'}`}>
                                    {selectedType}
                                </Button>
                             </>
                         )}

                         {!selectedFamily && <span className="text-muted-foreground ml-2">Selecciona un producto...</span>}
                    </div>

                    {/* GRID NIVEL 1: FAMILIES */}
                    {posView === 'FAMILY' && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in zoom-in-95 duration-200">
                           {productFamilies.map(fam => (
                               <Button 
                                   key={fam} 
                                   variant="outline" 
                                   className="h-24 text-lg font-bold hover:bg-blue-50 border-2 hover:border-blue-500 whitespace-normal break-words shadow-sm transition-all"
                                   onClick={() => handleFamilySelect(fam)}
                               >
                                   {fam}
                               </Button>
                           ))}
                        </div>
                    )}

                    {/* GRID NIVEL 2: TIPOS (Nuevo Nivel) */}
                    {posView === 'TYPE' && (
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in slide-in-from-right-4 duration-200">
                           {familyTypes.map(type => (
                               <Button 
                                   key={type} 
                                   variant="outline" 
                                   className="h-24 text-lg font-bold hover:bg-blue-50 border-2 hover:border-blue-500 whitespace-normal break-words shadow-sm transition-all"
                                   onClick={() => handleTypeSelect(type)}
                               >
                                   {type}
                               </Button>
                           ))}
                         </div>
                    )}

                    {/* GRID NIVEL 3: CALIDADES/VARIANTES (Final) */}
                    {posView === 'QUALITY' && (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-right-4 duration-200">
                           {typeQualities.map(prod => (
                               <Button 
                                   key={prod.id} 
                                   variant={currentItem.product_id === prod.id ? "default" : "outline"} 
                                   className={`h-24 flex flex-col items-center justify-center gap-1 border-2 transition-all ${currentItem.product_id === prod.id ? 'ring-2 ring-primary ring-offset-2 border-primary' : 'hover:border-blue-500'}`}
                                   onClick={() => handleFinalProductSelect(prod.id)}
                               >
                                   <span className="font-bold text-lg">{prod.quality}</span>
                                   {(stockMap[prod.id] || 0) < 10 && (
                                      <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full font-bold mt-1">
                                         Stock: {(stockMap[prod.id] || 0).toFixed(1)}
                                      </span>
                                   )}
                               </Button>
                           ))}
                        </div>
                    )}
                </div>

                {/* 2. INPUTS DE CANTIDAD (Zona Media) */}
                <div className="grid grid-cols-12 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                     <div className="col-span-12 mb-2">
                         <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Producto a Agregar</Label>
                         <div className="text-xl font-bold text-blue-900 flex items-center gap-2 min-h-[32px]">
                             {currentItem.product_id ? (
                                 <>
                                    <Box className="h-5 w-5" />
                                    {getProductById(currentItem.product_id)?.name} - {getProductById(currentItem.product_id)?.type} {getProductById(currentItem.product_id)?.quality}
                                 </>
                             ) : (
                                 <span className="text-gray-400 italic font-normal">Selecciona un producto arriba...</span>
                             )}
                         </div>
                     </div>

                     <div className="col-span-6 md:col-span-3">
                        <Label className="text-sm font-medium mb-1.5 flex items-center gap-1"><Scale className="h-3 w-3" /> Peso (KG)</Label>
                        <Input 
                            ref={kgInputRef}
                            className={`h-12 text-xl font-bold text-center ${!currentItem.quantity_kg ? 'bg-white' : 'bg-green-50 border-green-300'}`}
                            placeholder="0.00"
                            value={currentItem.quantity_kg}
                            onChange={(e) => handleCurrentNumericInput('quantity_kg', e.target.value)}
                            disabled={!currentItem.product_id}
                        />
                     </div>

                     <div className="col-span-6 md:col-span-3">
                        <Label className="text-sm font-medium mb-1.5 flex items-center gap-1"><Package className="h-3 w-3" /> Javas</Label>
                        <Input 
                             className="h-12 text-xl font-bold text-center"
                             placeholder="0.00"
                             value={currentItem.quantity_javas}
                             onChange={(e) => handleCurrentNumericInput('quantity_javas', e.target.value)}
                             disabled={!currentItem.product_id}
                        />
                     </div>

                     <div className="col-span-6 md:col-span-3">
                        <Label className="text-sm font-medium mb-1.5">Precio x KG</Label>
                        <Input 
                             className="h-12 text-xl font-bold text-center"
                             placeholder="S/ 0.00"
                             value={currentItem.price_per_kg}
                             onChange={(e) => handleCurrentNumericInput('price_per_kg', e.target.value)}
                             disabled={!currentItem.product_id}
                        />
                     </div>
                     
                     {/* 3. BOTÓN AGREGAR (Zona Inferior Inputs) */}
                     <div className="col-span-6 md:col-span-3">
                        <Button 
                            className="w-full h-12 text-lg font-bold shadow-md bg-blue-600 hover:bg-blue-700 transition-all" 
                            onClick={handleAddItemToCart}
                            disabled={!currentItem.product_id || !parseFloat(currentItem.quantity_kg)}
                        >
                            AGREGAR <Plus className="ml-2 h-5 w-5" />
                        </Button>
                     </div>
                </div>

                {/* 4. TABLA DE ITEMS AGREGADOS (CARRITO) */}
                {items.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-100">
                                    <TableHead className="w-[40%]">Producto</TableHead>
                                    <TableHead className="text-right">Peso/Javas</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead className="text-right">Subtotal</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, index) => {
                                    const product = getProductById(item.product_id);
                                    const vals = calculateItemValues(item);
                                    return (
                                        <TableRow key={item.id || index} className="hover:bg-gray-50">
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span className="text-base">{product?.name}</span>
                                                    <span className="text-xs text-gray-500">{product?.type} {product?.quality}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-bold">{vals.quantityKg.toFixed(2)} kg</div>
                                                <div className="text-xs text-gray-400">{vals.quantityJavas.toFixed(1)} javas</div>
                                            </TableCell>
                                            <TableCell className="text-right">S/ {vals.pricePerKg.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-bold text-blue-700">S/ {vals.subtotal.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => removeItem(index)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
                        <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>Carrito vacío. Agrega productos arriba.</p>
                    </div>
                )}
            </div>
          </CardContent>
          
          {/* ===== FOOTER CON TOTALES ===== */}
          <CardFooter className="flex flex-col items-end gap-4 bg-gray-50 p-6">
            <div className="text-right space-y-1 w-full md:w-auto">
              <p className="text-sm text-gray-500">
                Total: {totals.kg.toFixed(2)} kg ({totals.javas.toFixed(2)} javas)
              </p>
              <p className="text-sm text-gray-500">Subtotal: S/ {totals.amount.toFixed(2)}</p>
              
              {mode === 'PEDIDO' && selectedClient && (
                <>
                  <p className="text-sm text-gray-500">
                    Deuda Anterior: S/ {Number(selectedClient.current_debt).toFixed(2)}
                  </p>
                  {parseFloat(amortization) > 0 && (
                    <p className="text-sm text-green-600">
                      Amortización: - S/ {parseFloat(amortization).toFixed(2)}
                    </p>
                  )}
                  <p className="text-xl font-bold text-primary">
                    Nueva Deuda: S/ {Math.max(0, (totals.amount + Number(selectedClient.current_debt)) - (parseFloat(amortization) || 0)).toFixed(2)}
                  </p>
                </>
              )}
              {mode === 'CAJA' && (
                <p className="text-xl font-bold text-primary">
                  Total a Pagar: S/ {totals.amount.toFixed(2)}
                </p>
              )}
            </div>
            
            {/* Warning banner if stock issues */}
            {hasAnyStockWarning && (
              <div className="w-full p-3 bg-yellow-100 border border-yellow-300 rounded-lg flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">
                  Algunos productos tienen stock insuficiente. Se registrarán en negativo.
                </span>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none px-6 py-6 text-base"
                onClick={() => handleShowConfirmation(false)} 
                disabled={createVenta.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Solo Guardar
              </Button>
              <Button 
                className="flex-1 sm:flex-none px-6 py-6 text-base"
                onClick={() => handleShowConfirmation(true)} 
                disabled={createVenta.isPending}
              >
                <Printer className="h-4 w-4 mr-2" />
                {createVenta.isPending ? 'Procesando...' : 'Guardar e Imprimir'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </Tabs>

      {/* ===== MODAL DE CONFIRMACIÓN ===== */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar Venta</DialogTitle>
            <DialogDescription>Revisa los detalles antes de confirmar</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {mode === 'PEDIDO' && selectedClient && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-medium">Cliente: {selectedClient.name}</p>
                {selectedClient.whatsapp_number && (
                  <p className="text-sm text-gray-600">Tel: {selectedClient.whatsapp_number}</p>
                )}
              </div>
            )}
            
            {mode === 'CAJA' && guestClientName && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">Cliente: {guestClientName}</p>
                <p className="text-sm text-gray-600">Pago: {paymentMethod}</p>
              </div>
            )}
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio/KG</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const product = getProductById(item.product_id);
                  const values = calculateItemValues(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {product?.name || 'Producto'} - {product?.type} - {product?.quality}
                      </TableCell>
                      <TableCell className="text-right">
                        {values.quantityKg} kg
                        <span className="text-xs text-muted-foreground ml-1">
                          ({values.quantityJavas.toFixed(2)} j)
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        S/ {values.pricePerKg.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        S/ {values.subtotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Venta:</span>
                <span>S/ {totals.amount.toFixed(2)}</span>
              </div>
              
              {mode === 'PEDIDO' && selectedClient && (
                <div className="bg-yellow-50 p-4 rounded-lg space-y-1">
                  <div className="flex justify-between">
                    <span>Deuda Anterior:</span>
                    <span>S/ {Number(selectedClient.current_debt).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Venta Actual:</span>
                    <span>S/ {totals.amount.toFixed(2)}</span>
                  </div>
                  {parseFloat(amortization) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>- Amortización:</span>
                      <span>S/ {parseFloat(amortization).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Nueva Deuda Total:</span>
                    <span className="text-red-600">
                      S/ {Math.max(0, (totals.amount + Number(selectedClient.current_debt)) - (parseFloat(amortization) || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmedSubmit} disabled={createVenta.isPending}>
              {shouldPrintAfterSave ? (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Confirmar e Imprimir
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL NUEVO CLIENTE ===== */}
      <Dialog open={showNewClientModal} onOpenChange={setShowNewClientModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>Crear un nuevo cliente rápidamente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp (opcional)</Label>
              <Input
                value={newClientWhatsapp}
                onChange={(e) => setNewClientWhatsapp(e.target.value)}
                placeholder="+51 999 999 999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={createNewClient} 
              disabled={createClientMutation.isPending || !newClientName.trim()}
            >
              {createClientMutation.isPending ? 'Creando...' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden Ticket for Printing */}
      <div className="hidden">
        <TicketTemplate ref={ticketRef} sale={lastSale} client={selectedClient} />
      </div>
    </div>
  );
}
