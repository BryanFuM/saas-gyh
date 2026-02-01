/**
 * Database Types for Supabase
 * 
 * Estos tipos se generan automáticamente con:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
 * 
 * Por ahora, definimos los tipos manualmente basados en nuestro schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          role: 'ADMIN' | 'VENDEDOR' | 'INVENTOR';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password_hash: string;
          role?: 'ADMIN' | 'VENDEDOR' | 'INVENTOR';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          password_hash?: string;
          role?: 'ADMIN' | 'VENDEDOR' | 'INVENTOR';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_types: {
        Row: {
          id: number;
          name: string;
          has_variants: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          has_variants?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          has_variants?: boolean;
          created_at?: string;
        };
      };
      product_qualities: {
        Row: {
          id: number;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          created_at?: string;
        };
      };
      products: {
        Row: {
          id: number;
          name: string;
          type: string;
          quality: string;
          conversion_factor: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          type: string;
          quality: string;
          conversion_factor?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          type?: string;
          quality?: string;
          conversion_factor?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: number;
          name: string;
          whatsapp_number: string | null;
          current_debt: number;
          credit_limit: number;
          days_without_payment: number;
          last_payment_date: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          whatsapp_number?: string | null;
          current_debt?: number;
          credit_limit?: number;
          days_without_payment?: number;
          last_payment_date?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          whatsapp_number?: string | null;
          current_debt?: number;
          credit_limit?: number;
          days_without_payment?: number;
          last_payment_date?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      client_payments: {
        Row: {
          id: number;
          client_id: number;
          amount: number;
          payment_method: 'EFECTIVO' | 'YAPE' | 'CREDITO';
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          client_id: number;
          amount: number;
          payment_method?: 'EFECTIVO' | 'YAPE' | 'CREDITO';
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          client_id?: number;
          amount?: number;
          payment_method?: 'EFECTIVO' | 'YAPE' | 'CREDITO';
          notes?: string | null;
          created_at?: string;
        };
      };
      inventory: {
        Row: {
          id: number;
          product_id: number;
          quantity_javas: number;
          average_cost_per_java: number;
          last_updated: string;
        };
        Insert: {
          id?: number;
          product_id: number;
          quantity_javas?: number;
          average_cost_per_java?: number;
          last_updated?: string;
        };
        Update: {
          id?: number;
          product_id?: number;
          quantity_javas?: number;
          average_cost_per_java?: number;
          last_updated?: string;
        };
      };
      ingreso_lotes: {
        Row: {
          id: number;
          truck_plate: string;
          truck_color: string | null;
          date: string;
          total_javas: number;
          total_kg: number;
          total_cost: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          truck_plate: string;
          truck_color?: string | null;
          date?: string;
          total_javas?: number;
          total_kg?: number;
          total_cost?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          truck_plate?: string;
          truck_color?: string | null;
          date?: string;
          total_javas?: number;
          total_kg?: number;
          total_cost?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      ingreso_items: {
        Row: {
          id: number;
          ingreso_lote_id: number;
          supplier_name: string;
          product_id: number;
          quantity_javas: number;
          conversion_factor: number;
          total_kg: number;
          cost_per_java: number;
          total_cost: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          ingreso_lote_id: number;
          supplier_name: string;
          product_id: number;
          quantity_javas: number;
          conversion_factor?: number;
          total_kg: number;
          cost_per_java: number;
          total_cost: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          ingreso_lote_id?: number;
          supplier_name?: string;
          product_id?: number;
          quantity_javas?: number;
          conversion_factor?: number;
          total_kg?: number;
          cost_per_java?: number;
          total_cost?: number;
          created_at?: string;
        };
      };
      ventas: {
        Row: {
          id: number;
          date: string;
          type: 'CAJA' | 'PEDIDO';
          client_id: number | null;
          guest_client_name: string | null;
          user_id: string;
          total_amount: number;
          payment_method: 'EFECTIVO' | 'YAPE' | 'CREDITO';
          amortization: number;
          previous_debt: number;
          new_debt: number;
          is_printed: boolean;
          is_cancelled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          date?: string;
          type: 'CAJA' | 'PEDIDO';
          client_id?: number | null;
          guest_client_name?: string | null;
          user_id: string;
          total_amount?: number;
          payment_method?: 'EFECTIVO' | 'YAPE' | 'CREDITO';
          amortization?: number;
          previous_debt?: number;
          new_debt?: number;
          is_printed?: boolean;
          is_cancelled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          date?: string;
          type?: 'CAJA' | 'PEDIDO';
          client_id?: number | null;
          guest_client_name?: string | null;
          user_id?: string;
          total_amount?: number;
          payment_method?: 'EFECTIVO' | 'YAPE' | 'CREDITO';
          amortization?: number;
          previous_debt?: number;
          new_debt?: number;
          is_printed?: boolean;
          is_cancelled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      venta_items: {
        Row: {
          id: number;
          venta_id: number;
          product_id: number;
          quantity_kg: number;
          quantity_javas: number;
          conversion_factor: number;
          price_per_kg: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          venta_id: number;
          product_id: number;
          quantity_kg: number;
          quantity_javas: number;
          conversion_factor: number;
          price_per_kg: number;
          subtotal: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          venta_id?: number;
          product_id?: number;
          quantity_kg?: number;
          quantity_javas?: number;
          conversion_factor?: number;
          price_per_kg?: number;
          subtotal?: number;
          created_at?: string;
        };
      };
      inventory_adjustments: {
        Row: {
          id: number;
          product_id: number;
          quantity_javas: number;
          adjustment_type: string;
          reason: string | null;
          cost_impact: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          product_id: number;
          quantity_javas: number;
          adjustment_type: string;
          reason?: string | null;
          cost_impact?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          product_id?: number;
          quantity_javas?: number;
          adjustment_type?: string;
          reason?: string | null;
          cost_impact?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      v_stock_disponible: {
        Row: {
          product_id: number;
          name: string;
          type: string;
          quality: string;
          conversion_factor: number;
          full_name: string;
          stock_javas: number;
          stock_kg: number;
          costo_promedio_java: number;
          estado_stock: 'NORMAL' | 'BAJO' | 'NEGATIVO';
        };
      };
      v_clientes_deuda: {
        Row: {
          id: number;
          name: string;
          whatsapp_number: string | null;
          current_debt: number;
          credit_limit: number;
          days_without_payment: number;
          last_payment_date: string | null;
          is_active: boolean;
          semaforo_deuda: 'VERDE' | 'AMARILLO' | 'ROJO';
          alerta_deuda_alta: boolean;
        };
      };
    };
    Functions: {
      crear_venta: {
        Args: {
          p_type: 'CAJA' | 'PEDIDO';
          p_client_id: number | null;
          p_guest_client_name: string | null;
          p_user_id: string;
          p_payment_method: 'EFECTIVO' | 'YAPE' | 'CREDITO';
          p_amortization: number;
          p_items: Json;
        };
        Returns: Json;
      };
      crear_ingreso: {
        Args: {
          p_truck_plate: string;
          p_truck_color: string | null;
          p_user_id: string | null;
          p_notes: string | null;
          p_items: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: 'ADMIN' | 'VENDEDOR' | 'INVENTOR';
      venta_type: 'CAJA' | 'PEDIDO';
      payment_method: 'EFECTIVO' | 'YAPE' | 'CREDITO';
    };
  };
};

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];
