/**
 * Centralized API client for all backend communication.
 * Handles authentication, error handling, and token refresh.
 */
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * API Error class with structured error data
 */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Get authentication headers
 */
function getAuthHeaders(): Record<string, string> {
  const token = Cookies.get('token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Attempt to refresh the access token
 */
async function refreshToken(): Promise<boolean> {
  const refreshToken = Cookies.get('refreshToken');
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    Cookies.set('token', data.access_token, { expires: 1 });
    Cookies.set('refreshToken', data.refresh_token, { expires: 7 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse API error response
 */
async function parseError(response: Response): Promise<ApiError> {
  try {
    const data = await response.json();
    if (data.error) {
      return new ApiError(
        data.error.message || 'Error desconocido',
        data.error.code || 'UNKNOWN_ERROR',
        response.status,
        data.error.details
      );
    }
    if (data.detail) {
      return new ApiError(
        typeof data.detail === 'string' ? data.detail : 'Error de validación',
        'VALIDATION_ERROR',
        response.status
      );
    }
  } catch {
    // Failed to parse JSON
  }
  return new ApiError(
    `Error ${response.status}: ${response.statusText}`,
    'HTTP_ERROR',
    response.status
  );
}

/**
 * Base fetch function with error handling and token refresh
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 - try to refresh token
  if (response.status === 401 && retry) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return apiFetch<T>(endpoint, options, false);
    }
    // Redirect to login if refresh failed
    if (typeof window !== 'undefined') {
      Cookies.remove('token');
      Cookies.remove('refreshToken');
      window.location.href = '/login';
    }
    throw new ApiError('Sesión expirada', 'SESSION_EXPIRED', 401);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  // Handle empty responses (204)
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

/**
 * API client with typed methods
 */
export const api = {
  // Auth endpoints
  auth: {
    login: async (username: string, password: string) => {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });
      
      if (!response.ok) {
        throw await parseError(response);
      }
      
      const data = await response.json();
      Cookies.set('token', data.access_token, { expires: 1 });
      Cookies.set('refreshToken', data.refresh_token, { expires: 7 });
      return data;
    },
    
    logout: () => {
      Cookies.remove('token');
      Cookies.remove('refreshToken');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
    
    me: () => apiFetch<{ id: number; username: string; role: string }>('/users/me'),
  },

  // Products
  products: {
    list: () => apiFetch<Product[]>('/products'),
    get: (id: number) => apiFetch<Product>(`/products/${id}`),
    create: (data: ProductCreate) => apiFetch<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id: number, data: Partial<ProductCreate>) => apiFetch<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id: number) => apiFetch<void>(`/products/${id}`, { method: 'DELETE' }),
  },

  // Clients
  clients: {
    list: () => apiFetch<Client[]>('/clients'),
    get: (id: number) => apiFetch<Client>(`/clients/${id}`),
    create: (data: ClientCreate) => apiFetch<Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id: number, data: Partial<ClientCreate>) => apiFetch<Client>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },

  // Ingresos
  ingresos: {
    list: (skip = 0, limit = 50) => apiFetch<IngresoLote[]>(`/ingresos?skip=${skip}&limit=${limit}`),
    get: (id: number) => apiFetch<IngresoLote>(`/ingresos/${id}`),
    create: (data: IngresoLoteCreate) => apiFetch<IngresoLote>('/ingresos', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    delete: (id: number) => apiFetch<void>(`/ingresos/${id}`, { method: 'DELETE' }),
    stock: () => apiFetch<StockInfo[]>('/ingresos/stock/disponible'),
    stockDetail: () => apiFetch<StockDetail[]>('/ingresos/stock/detalle'),
  },

  // Ventas
  ventas: {
    list: (params?: VentaListParams) => {
      const queryParams = new URLSearchParams();
      if (params?.date) queryParams.append('date', params.date);
      if (params?.start_date) queryParams.append('start_date', params.start_date);
      if (params?.end_date) queryParams.append('end_date', params.end_date);
      if (params?.client_id) queryParams.append('client_id', params.client_id.toString());
      if (params?.type) queryParams.append('type', params.type);
      if (params?.skip) queryParams.append('skip', params.skip.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      const query = queryParams.toString();
      return apiFetch<Venta[]>(`/ventas${query ? `?${query}` : ''}`);
    },
    get: (id: number) => apiFetch<Venta>(`/ventas/${id}`),
    create: (data: VentaCreate) => apiFetch<Venta>('/ventas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id: number, data: VentaUpdate) => apiFetch<Venta>(`/ventas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id: number) => apiFetch<void>(`/ventas/${id}`, { method: 'DELETE' }),
    markPrinted: (id: number) => apiFetch<void>(`/ventas/${id}/print`, { method: 'PATCH' }),
  },
};

// Type definitions for API
export interface Product {
  id: number;
  name: string;
  type: string;
  quality: string;
  conversion_factor: number;
}

export interface ProductCreate {
  name: string;
  type: string;
  quality: string;
  conversion_factor?: number;
}

export interface Client {
  id: number;
  name: string;
  whatsapp_number?: string;
  current_debt: number;
}

export interface ClientCreate {
  name: string;
  whatsapp_number?: string;
  current_debt?: number;
}

export interface IngresoItem {
  id: number;
  supplier_name: string;
  product_id: number;
  product_name?: string;
  total_kg: number;
  conversion_factor: number;
  total_javas: number;
  cost_per_java: number;
  total_cost: number;
}

export interface IngresoItemCreate {
  supplier_name: string;
  product_id: number;
  total_kg: number;
  conversion_factor: number;
  cost_price_input: number;
  cost_price_mode: 'KG' | 'JAVA';
}

export interface IngresoLote {
  id: number;
  date: string;
  truck_id: string;
  items: IngresoItem[];
  total_kg?: number;
  total_javas?: number;
  total_cost?: number;
}

export interface IngresoLoteCreate {
  truck_id: string;
  date?: string;
  items: IngresoItemCreate[];
}

export interface StockInfo {
  product_id: number;
  product_name: string;
  total_javas_available: number;
}

export interface StockDetail {
  product_id: number;
  product_name: string;
  total_ingreso_kg: number;
  total_ingreso_javas: number;
  total_vendido_kg: number;
  total_vendido_javas: number;
  stock_disponible_kg: number;
  stock_disponible_javas: number;
  costo_promedio_java: number;
}

export interface VentaItem {
  id: number;
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
  type: 'CAJA' | 'PEDIDO';
  client_id?: number;
  client_name?: string;
  user_id: number;
  user_name?: string;
  total_amount: number;
  is_printed: boolean;
  items: VentaItem[];
  previous_debt?: number;
  new_debt?: number;
}

export interface VentaCreate {
  type: 'CAJA' | 'PEDIDO';
  client_id?: number;
  items: VentaItemCreate[];
}

export interface VentaUpdate {
  client_id?: number;
  items: VentaItemCreate[];
}

export interface VentaListParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  client_id?: number;
  type?: 'CAJA' | 'PEDIDO';
  skip?: number;
  limit?: number;
}
