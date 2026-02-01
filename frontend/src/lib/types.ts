/**
 * Supabase Types for Agroinversiones Beto
 * Auto-generated types + custom interfaces
 */

// =============================================
// ENUMS
// =============================================
export type UserRole = 'ADMIN' | 'VENDEDOR' | 'INVENTOR';
export type VentaType = 'CAJA' | 'PEDIDO';
export type PaymentMethod = 'EFECTIVO' | 'YAPE' | 'CREDITO';
export type StockStatus = 'NORMAL' | 'BAJO' | 'NEGATIVO';
export type DebtSemaphore = 'VERDE' | 'AMARILLO' | 'ROJO';

// =============================================
// BASE ENTITIES
// =============================================

export interface User {
  id: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface ProductType {
  id: number;
  name: string;
  has_variants: boolean;
}

export interface ProductQuality {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  type: string;
  quality: string;
  conversion_factor: number; // Default 17
  is_active: boolean;
}

export interface ProductCreate {
  name: string;
  type: string;
  quality: string;
  conversion_factor?: number;
}

// =============================================
// INVENTORY
// =============================================

export interface Inventory {
  id: number;
  product_id: number;
  quantity_javas: number; // Puede ser negativo
  average_cost_per_java: number;
  last_updated: string;
}

export interface StockInfo {
  product_id: number;
  name: string;
  type: string;
  quality: string;
  full_name: string;
  stock_javas: number;
  stock_kg: number;
  costo_promedio_java: number;
  estado_stock: StockStatus;
}

// =============================================
// CLIENTS
// =============================================

export interface Client {
  id: number;
  name: string;
  whatsapp_number?: string;
  current_debt: number;
  credit_limit: number;
  days_without_payment: number;
  last_payment_date?: string;
  is_active: boolean;
  // Campos calculados (de la vista)
  semaforo_deuda?: DebtSemaphore;
  alerta_deuda_alta?: boolean;
}

export interface ClientCreate {
  name: string;
  whatsapp_number?: string;
  current_debt?: number;
  credit_limit?: number;
}

export interface ClientPayment {
  id: number;
  client_id: number;
  amount: number;
  payment_method: PaymentMethod;
  notes?: string;
  created_at: string;
}

export interface ClientPaymentCreate {
  amount: number;
  payment_method?: PaymentMethod;
  notes?: string;
}

// =============================================
// INGRESOS (Recepción de Mercadería)
// NUEVO: Input principal es JAVAS
// =============================================

export interface IngresoItem {
  id: number;
  ingreso_lote_id: number;
  supplier_name: string;
  product_id: number;
  product_name?: string;
  quantity_javas: number;      // INPUT PRINCIPAL
  conversion_factor: number;
  total_kg: number;            // Calculado: javas * factor
  cost_per_java: number;
  total_cost: number;
}

export interface IngresoItemCreate {
  supplier_name: string;
  product_id: number;
  quantity_javas: number;      // INPUT PRINCIPAL (CAMBIO)
  conversion_factor: number;
  cost_per_java: number;
}

export interface IngresoLote {
  id: number;
  truck_plate: string;
  truck_color?: string;
  date: string;
  total_javas: number;
  total_kg: number;
  total_cost: number;
  notes?: string;
  items: IngresoItem[];
}

export interface IngresoLoteCreate {
  truck_plate: string;
  truck_color?: string;
  date?: string;
  items: IngresoItemCreate[];
  notes?: string;
}

// =============================================
// VENTAS
// =============================================

export interface VentaItem {
  id: number;
  venta_id: number;
  product_id: number;
  product_name?: string;
  quantity_kg: number;
  quantity_javas: number;
  conversion_factor: number;
  price_per_kg: number;
  subtotal: number;
}

export interface VentaItemCreate {
  product_id: number;
  quantity_kg: number;
  price_per_kg: number;
}

export interface Venta {
  id: number;
  date: string;
  type: VentaType;
  client_id?: number;
  client_name?: string;
  guest_client_name?: string;    // NUEVO: nombre para ventas contado
  user_id: string;
  user_name?: string;
  total_amount: number;
  payment_method: PaymentMethod;  // NUEVO
  amortization: number;           // NUEVO: pago a cuenta
  previous_debt: number;
  new_debt: number;
  is_printed: boolean;
  is_cancelled: boolean;
  items: VentaItem[];
}

export interface VentaCreate {
  type: VentaType;
  client_id?: number;
  guest_client_name?: string;     // NUEVO
  payment_method: PaymentMethod;  // NUEVO
  amortization?: number;          // NUEVO
  items: VentaItemCreate[];
}

export interface VentaUpdate {
  client_id?: number;
  guest_client_name?: string;
  payment_method?: PaymentMethod;
  items?: VentaItemCreate[];
}

// =============================================
// FILTERS & PARAMS
// =============================================

export interface VentaListParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  client_id?: number;
  type?: VentaType;
  payment_method?: PaymentMethod;
  skip?: number;
  limit?: number;
}

// =============================================
// PRODUCT HIERARCHY (para selector en cascada)
// =============================================

export interface ProductName {
  name: string;
}

export interface ProductVariant {
  name: string;
  type: string;
  quality: string;
  product_id: number;
}

// =============================================
// INVENTORY ADJUSTMENTS
// =============================================

export type AdjustmentType = 'MERMA' | 'ROBO' | 'ERROR_CONTEO' | 'CONSUMO_INTERNO';

export interface InventoryAdjustment {
  id: number;
  product_id: number;
  quantity_javas: number;
  adjustment_type: AdjustmentType;
  reason?: string;
  cost_impact?: number;
  created_by?: string;
  created_at: string;
}

export interface InventoryAdjustmentCreate {
  product_id: number;
  quantity_javas: number;
  adjustment_type: AdjustmentType;
  reason?: string;
}

// =============================================
// DASHBOARD STATS
// =============================================

export interface DashboardStats {
  total_stock_javas: number;
  total_products: number;
  ventas_efectivo_hoy: number;
  ventas_yape_hoy: number;
  ventas_credito_hoy: number;
  total_ventas_hoy: number;
}

// =============================================
// VALIDATION CONSTANTS
// =============================================

export const DEBT_ALERT_THRESHOLD = 1000; // Soles
export const DEFAULT_CONVERSION_FACTOR = 17;
export const LOW_STOCK_THRESHOLD = 10; // Javas
