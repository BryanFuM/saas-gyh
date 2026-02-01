/**
 * Tests for handling backend numeric values that come as strings.
 * 
 * The backend uses Python Decimal for precision, which serializes to strings in JSON.
 * These tests ensure the frontend correctly handles these string values.
 */
import { describe, it, expect } from 'vitest'

/**
 * Utility function to safely format numbers from backend.
 * This is what we use throughout the app to prevent ".toFixed is not a function" errors.
 */
function safeToFixed(value: string | number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) {
    return '0.00'
  }
  return Number(value).toFixed(decimals)
}

/**
 * Utility function to safely add numbers from backend.
 */
function safeAdd(a: string | number, b: string | number): number {
  return Number(a) + Number(b)
}

describe('Backend Numeric Value Handling', () => {
  
  describe('safeToFixed utility', () => {
    it('handles number values correctly', () => {
      expect(safeToFixed(123.456)).toBe('123.46')
      expect(safeToFixed(100)).toBe('100.00')
      expect(safeToFixed(0)).toBe('0.00')
    })

    it('handles string values from backend Decimal fields', () => {
      // Backend Decimal serializes as string
      expect(safeToFixed('123.456')).toBe('123.46')
      expect(safeToFixed('100.00')).toBe('100.00')
      expect(safeToFixed('0')).toBe('0.00')
      expect(safeToFixed('99.99')).toBe('99.99')
    })

    it('handles null and undefined values', () => {
      expect(safeToFixed(null)).toBe('0.00')
      expect(safeToFixed(undefined)).toBe('0.00')
    })

    it('handles custom decimal places', () => {
      expect(safeToFixed(123.456, 1)).toBe('123.5')
      expect(safeToFixed('123.456', 3)).toBe('123.456')
      expect(safeToFixed('123.456', 0)).toBe('123')
    })
  })

  describe('safeAdd utility', () => {
    it('adds two numbers correctly', () => {
      expect(safeAdd(100, 50)).toBe(150)
    })

    it('adds number and string correctly', () => {
      expect(safeAdd(100, '50.00')).toBe(150)
      expect(safeAdd('100.00', 50)).toBe(150)
    })

    it('adds two strings correctly (backend Decimal values)', () => {
      expect(safeAdd('100.00', '50.00')).toBe(150)
      expect(safeAdd('123.45', '67.89')).toBeCloseTo(191.34)
    })
  })
})

describe('Client Payment Data Simulation', () => {
  // Simulating data as it comes from the backend
  interface PaymentFromBackend {
    id: number
    amount: string  // Decimal comes as string
    date: string
    notes: string | null
  }

  const mockPayments: PaymentFromBackend[] = [
    { id: 1, amount: '150.00', date: '2026-01-10T10:00:00Z', notes: 'Pago parcial' },
    { id: 2, amount: '250.50', date: '2026-01-11T15:30:00Z', notes: null },
    { id: 3, amount: '99.99', date: '2026-01-11T16:00:00Z', notes: 'Pago final' },
  ]

  it('formats payment amounts correctly', () => {
    mockPayments.forEach(payment => {
      const formatted = Number(payment.amount).toFixed(2)
      expect(formatted).toMatch(/^\d+\.\d{2}$/)
    })
  })

  it('calculates total payments correctly', () => {
    const total = mockPayments.reduce((acc, p) => acc + Number(p.amount), 0)
    expect(total).toBeCloseTo(500.49, 2)
  })
})

describe('Client Debt Data Simulation', () => {
  interface ClientFromBackend {
    id: number
    name: string
    current_debt: string  // Decimal comes as string
    whatsapp_number: string | null
  }

  const mockClients: ClientFromBackend[] = [
    { id: 1, name: 'Juan Pérez', current_debt: '500.00', whatsapp_number: '999888777' },
    { id: 2, name: 'María García', current_debt: '0', whatsapp_number: null },
    { id: 3, name: 'Carlos López', current_debt: '1234.56', whatsapp_number: '998877665' },
  ]

  it('formats client debt correctly', () => {
    mockClients.forEach(client => {
      const formatted = Number(client.current_debt).toFixed(2)
      expect(formatted).toMatch(/^\d+\.\d{2}$/)
    })
  })

  it('calculates new debt after sale correctly', () => {
    const client = mockClients[0]
    const saleAmount = 150.75
    
    const newDebt = Number(client.current_debt) + saleAmount
    expect(newDebt).toBeCloseTo(650.75, 2)
    expect(newDebt.toFixed(2)).toBe('650.75')
  })

  it('handles zero debt correctly', () => {
    const client = mockClients[1]
    expect(Number(client.current_debt).toFixed(2)).toBe('0.00')
  })
})

describe('Stock Data Simulation', () => {
  interface StockFromBackend {
    product_id: number
    product_name: string
    total_javas_available: number | string  // Could be number or string
  }

  const mockStock: StockFromBackend[] = [
    { product_id: 1, product_name: 'Mango Kent', total_javas_available: 150.5 },
    { product_id: 2, product_name: 'Palta Fuerte', total_javas_available: '85.25' },
    { product_id: 3, product_name: 'Uva Red Globe', total_javas_available: 0 },
  ]

  it('formats stock quantities correctly', () => {
    mockStock.forEach(item => {
      const formatted = Number(item.total_javas_available).toFixed(2)
      expect(formatted).toMatch(/^\d+\.\d{2}$/)
    })
  })

  it('calculates total stock correctly', () => {
    const total = mockStock.reduce((acc, s) => acc + Number(s.total_javas_available), 0)
    expect(total).toBeCloseTo(235.75, 2)
  })
})

describe('Ingreso Lote Data Simulation', () => {
  interface IngresoItemFromBackend {
    id: number
    supplier_name: string
    product_id: number
    total_kg: number | string
    total_javas: number | string
    cost_per_java: number | string
    total_cost: number | string
  }

  interface IngresoLoteFromBackend {
    id: number
    truck_id: string
    date: string
    items: IngresoItemFromBackend[]
    total_kg: number | string | null
    total_javas: number | string | null
    total_cost: number | string | null
  }

  const mockLote: IngresoLoteFromBackend = {
    id: 1,
    truck_id: 'ABC-123',
    date: '2026-01-11T08:00:00Z',
    items: [
      { id: 1, supplier_name: 'Fundo San Juan', product_id: 1, total_kg: '500', total_javas: '25', cost_per_java: '80.00', total_cost: '2000.00' },
      { id: 2, supplier_name: 'Agricola Norte', product_id: 2, total_kg: '300', total_javas: '15', cost_per_java: '120.00', total_cost: '1800.00' },
    ],
    total_kg: '800',
    total_javas: '40',
    total_cost: '3800.00'
  }

  it('formats lote totals correctly', () => {
    expect(Number(mockLote.total_kg || 0).toFixed(2)).toBe('800.00')
    expect(Number(mockLote.total_javas || 0).toFixed(2)).toBe('40.00')
    expect(Number(mockLote.total_cost || 0).toFixed(2)).toBe('3800.00')
  })

  it('formats item values correctly', () => {
    mockLote.items.forEach(item => {
      expect(Number(item.total_javas).toFixed(1)).toMatch(/^\d+\.\d$/)
      expect(Number(item.cost_per_java).toFixed(2)).toMatch(/^\d+\.\d{2}$/)
      expect(Number(item.total_cost).toFixed(2)).toMatch(/^\d+\.\d{2}$/)
    })
  })

  it('handles null lote totals gracefully', () => {
    const emptyLote: IngresoLoteFromBackend = {
      id: 2,
      truck_id: 'XYZ-999',
      date: '2026-01-11T10:00:00Z',
      items: [],
      total_kg: null,
      total_javas: null,
      total_cost: null
    }

    expect(Number(emptyLote.total_kg || 0).toFixed(2)).toBe('0.00')
    expect(Number(emptyLote.total_javas || 0).toFixed(2)).toBe('0.00')
    expect(Number(emptyLote.total_cost || 0).toFixed(2)).toBe('0.00')
  })
})

describe('Venta Data Simulation', () => {
  interface VentaFromBackend {
    id: number
    date: string
    type: 'CAJA' | 'PEDIDO'
    client_id: number | null
    total_amount: string  // Decimal comes as string
    previous_debt: string | null
    new_debt: string | null
  }

  const mockVentas: VentaFromBackend[] = [
    { id: 1, date: '2026-01-11T09:00:00Z', type: 'CAJA', client_id: null, total_amount: '250.00', previous_debt: null, new_debt: null },
    { id: 2, date: '2026-01-11T10:00:00Z', type: 'PEDIDO', client_id: 1, total_amount: '500.50', previous_debt: '100.00', new_debt: '600.50' },
    { id: 3, date: '2026-01-11T11:00:00Z', type: 'PEDIDO', client_id: 2, total_amount: '175.25', previous_debt: '0', new_debt: '175.25' },
  ]

  it('formats venta amounts correctly', () => {
    mockVentas.forEach(venta => {
      expect(Number(venta.total_amount).toFixed(2)).toMatch(/^\d+\.\d{2}$/)
    })
  })

  it('calculates debt correctly for PEDIDO type', () => {
    const ventaPedido = mockVentas[1]
    const calculatedNewDebt = Number(ventaPedido.previous_debt || 0) + Number(ventaPedido.total_amount)
    expect(calculatedNewDebt).toBeCloseTo(600.50, 2)
  })

  it('handles null debt values for CAJA type', () => {
    const ventaCaja = mockVentas[0]
    expect(ventaCaja.previous_debt).toBeNull()
    expect(ventaCaja.new_debt).toBeNull()
  })

  it('calculates total ventas correctly', () => {
    const total = mockVentas.reduce((acc, v) => acc + Number(v.total_amount), 0)
    expect(total).toBeCloseTo(925.75, 2)
  })
})

describe('Edge Cases', () => {
  it('handles empty string as zero', () => {
    expect(Number('')).toBe(0)
    expect(Number('').toFixed(2)).toBe('0.00')
  })

  it('handles negative numbers from backend', () => {
    // Though unlikely, backend might send negative for corrections
    expect(Number('-50.00').toFixed(2)).toBe('-50.00')
  })

  it('handles very large numbers', () => {
    const bigNumber = '999999999.99'
    expect(Number(bigNumber).toFixed(2)).toBe('999999999.99')
  })

  it('handles very small decimal values', () => {
    const smallNumber = '0.01'
    expect(Number(smallNumber).toFixed(2)).toBe('0.01')
  })

  it('handles scientific notation (unlikely but possible)', () => {
    expect(Number('1e3').toFixed(2)).toBe('1000.00')
  })
})
