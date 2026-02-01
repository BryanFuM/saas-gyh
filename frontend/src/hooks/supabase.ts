/**
 * Barrel export for Supabase hooks
 * 
 * Para migrar gradualmente, importa desde aquí:
 * import { useProducts, useClients, useVentas, useStock } from '@/hooks/supabase';
 */

// Products
export { 
  useProducts, 
  useProductTypes, 
  useProductQualities,
  useProductsByType,
  useCreateProduct, 
  useUpdateProduct, 
  useDeleteProduct,
  productKeys,
  type Product,
  type ProductInsert,
  type ProductUpdate,
} from './use-products-supabase';

// Clients
export { 
  useClients, 
  useClientsWithDebt,
  useClient,
  useCreateClient, 
  useUpdateClient,
  useRegisterPayment,
  clientKeys,
  type Client,
  type ClientInsert,
  type ClientUpdate,
  type ClientWithDebtStatus,
} from './use-clients-supabase';

// Ventas
export { 
  useVentas, 
  useVenta,
  useCreateVenta, 
  useCancelVenta,
  useMarkVentaPrinted,
  ventaKeys,
  type Venta,
  type VentaItem,
  type VentaCreateInput,
  type VentaListParams,
} from './use-ventas-supabase';

// Ingresos
export {
  useIngresos,
  useIngreso,
  useCreateIngreso,
  useDeleteIngreso,
  ingresoKeys,
  type IngresoLote,
  type IngresoItem,
  type IngresoItemCreate,
  type IngresoLoteCreate,
} from './use-ingresos-supabase';

// Stock
export { 
  useStock, 
  useProductStock,
  useStockMap,
  stockKeys,
  type StockItem,
} from './use-stock-supabase';
