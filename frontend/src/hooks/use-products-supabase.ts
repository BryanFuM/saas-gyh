/**
 * React Query hooks for products - Connected to Supabase
 * Reemplaza use-products.ts (datos mock)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Tipo explícito para producto (compatible con la tabla products)
export interface Product {
  id: number;
  name: string;
  type: string;
  quality: string;
  conversion_factor: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductInsert {
  name: string;
  type: string;
  quality: string;
  conversion_factor?: number;
  is_active?: boolean;
}

export interface ProductUpdate {
  name?: string;
  type?: string;
  quality?: string;
  conversion_factor?: number;
  is_active?: boolean;
}

export const productKeys = {
  all: ['products'] as const,
  detail: (id: number) => [...productKeys.all, id] as const,
  byType: (type: string) => [...productKeys.all, 'byType', type] as const,
  types: ['product-types'] as const,
  qualities: ['product-qualities'] as const,
};

/**
 * Hook to fetch all active products from Supabase
 */
export function useProducts() {
  return useQuery<Product[]>({
    queryKey: productKeys.all,
    queryFn: async (): Promise<Product[]> => {
      console.log('📦 Fetching products from Supabase...');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('type')
        .order('name');

      if (error) {
        console.error('❌ Error fetching products:', error);
        throw new Error(error.message);
      }
      
      console.log(`✅ Loaded ${data.length} products`);
      return data as Product[];
    },
  });
}

/**
 * Hook to fetch unique product types (for cascade selector)
 */
export function useProductTypes() {
  return useQuery({
    queryKey: productKeys.types,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_types')
        .select('*')
        .order('name');

      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/**
 * Hook to fetch product qualities
 */
export function useProductQualities() {
  return useQuery({
    queryKey: productKeys.qualities,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_qualities')
        .select('*')
        .order('name');

      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/**
 * Hook to fetch products filtered by type (for cascade selector step 2)
 */
export function useProductsByType(type: string | null) {
  return useQuery({
    queryKey: productKeys.byType(type || ''),
    queryFn: async () => {
      if (!type) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .order('quality');

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!type,
  });
}

/**
 * Hook to create a product
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProductInsert) => {
      const { data: product, error } = await supabase
        .from('products')
        .insert(data)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

/**
 * Hook to update a product
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductUpdate }) => {
      const { data: product, error } = await supabase
        .from('products')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return product;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook to soft-delete a product
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      // Use RPC for smart delete (Check history first)
      const { data, error } = await supabase
        .rpc('delete_product_safely', { p_product_id: id });

      if (error) throw new Error(error.message);
      
      return data; // 'ARCHIVED' or 'DELETED'
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

/**
 * Hook to check if a product has history (usage)
 */
export function useCheckProductUsage() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase
        .rpc('check_product_usage', { p_product_id: id });

      if (error) throw new Error(error.message);
      
      return data as { has_history: boolean; usage_count: number };
    }
  });
}


// ============================================
// MUTATIONS PARA TIPOS Y CALIDADES
// ============================================

/**
 * Hook to create a product type
 */
export function useCreateProductType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('product_types')
        .insert({ name })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.types });
    },
  });
}

/**
 * Hook to delete a product type
 */
export function useDeleteProductType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('product_types')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.types });
    },
  });
}

/**
 * Hook to create a product quality
 */
export function useCreateProductQuality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('product_qualities')
        .insert({ name })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.qualities });
    },
  });
}

/**
 * Hook to delete a product quality
 */
export function useDeleteProductQuality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('product_qualities')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.qualities });
    },
  });
}

/**
 * Hook to get usage count for a product type (how many products use this type)
 */
export function useProductTypeUsageCount(typeId: number) {
  return useQuery({
    queryKey: [...productKeys.types, 'usage', typeId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('type', typeId);

      if (error) throw new Error(error.message);
      return { count: count || 0 };
    },
    enabled: !!typeId,
  });
}

/**
 * Hook to get usage count for a product quality
 */
export function useProductQualityUsageCount(qualityId: number) {
  return useQuery({
    queryKey: [...productKeys.qualities, 'usage', qualityId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('quality', qualityId);

      if (error) throw new Error(error.message);
      return { count: count || 0 };
    },
    enabled: !!qualityId,
  });
}
