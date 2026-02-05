/**
 * React Query hooks for clients - Connected to Supabase
 * Reemplaza use-clients.ts (datos mock)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Tipos explícitos para clientes
export interface Client {
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
}

export interface ClientInsert {
  name: string;
  whatsapp_number?: string | null;
  current_debt?: number;
  credit_limit?: number;
}

export interface ClientUpdate {
  name?: string;
  whatsapp_number?: string | null;
  current_debt?: number;
  credit_limit?: number;
  is_active?: boolean;
}

export interface ClientWithDebtStatus extends Client {
  semaforo_deuda: 'VERDE' | 'AMARILLO' | 'ROJO';
  alerta_deuda_alta: boolean;
}

export const clientKeys = {
  all: ['clients'] as const,
  detail: (id: number) => [...clientKeys.all, id] as const,
  withDebt: ['clients', 'with-debt'] as const,
};

/**
 * Hook to fetch all active clients from Supabase
 */
export function useClients() {
  return useQuery<Client[]>({
    queryKey: clientKeys.all,
    queryFn: async (): Promise<Client[]> => {
      console.log('👥 Fetching clients from Supabase...');
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('current_debt', { ascending: false })
        .order('name');

      if (error) {
        console.error('❌ Error fetching clients:', error);
        throw new Error(error.message);
      }
      
      console.log(`✅ Loaded ${data.length} clients`);
      return data as Client[];
    },
  });
}

/**
 * Hook to fetch clients with debt status (semáforo)
 */
export function useClientsWithDebt() {
  return useQuery<ClientWithDebtStatus[]>({
    queryKey: clientKeys.withDebt,
    queryFn: async (): Promise<ClientWithDebtStatus[]> => {
      const { data, error } = await supabase
        .from('v_clientes_deuda')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw new Error(error.message);
      return data as ClientWithDebtStatus[];
    },
  });
}

/**
 * Hook to fetch a single client
 */
export function useClient(id: number) {
  return useQuery<Client>({
    queryKey: clientKeys.detail(id),
    queryFn: async (): Promise<Client> => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data as Client;
    },
    enabled: !!id,
  });
}

/**
 * Hook to create a client
 */
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation<Client, Error, ClientInsert>({
    mutationFn: async (data: ClientInsert): Promise<Client> => {
      const { data: client, error } = await supabase
        .from('clients')
        .insert(data)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return client as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.withDebt });
    },
  });
}

/**
 * Hook to update a client
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ClientUpdate }) => {
      const { data: client, error } = await supabase
        .from('clients')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return client as Client;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.withDebt });
    },
  });
}

/**
 * Hook to register a client payment
 */
export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      client_id: number; 
      amount: number; 
      payment_method?: 'EFECTIVO' | 'YAPE' | 'CREDITO';
      notes?: string;
    }) => {
      // Insert payment
      const { error: paymentError } = await supabase
        .from('client_payments')
        .insert({
          client_id: data.client_id,
          amount: data.amount,
          payment_method: data.payment_method || 'EFECTIVO',
          notes: data.notes,
        });

      if (paymentError) throw new Error(paymentError.message);

      // Update client debt
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('current_debt')
        .eq('id', data.client_id)
        .single();

      if (clientError) throw new Error(clientError.message);

      const newDebt = Math.max(0, ((client as any).current_debt || 0) - data.amount);
      
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          current_debt: newDebt,
          last_payment_date: new Date().toISOString(),
          days_without_payment: 0,
        })
        .eq('id', data.client_id);

      if (updateError) throw new Error(updateError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.withDebt });
    },
  });
}

/**
 * Hook to fetch payment history for a client
 */
export function useClientPayments(clientId: number) {
  return useQuery({
    queryKey: ['client-payments', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_payments')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data as Array<{
        id: number;
        amount: number;
        notes: string | null;
        payment_method: string;
        created_at: string;
      }>;
    },
    enabled: !!clientId,
  });
}

/**
 * Hook to delete (soft delete) a client
 * Sets is_active = false instead of actually deleting
 */
export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: number) => {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: false })
        .eq('id', clientId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.withDebt });
    },
  });
}
