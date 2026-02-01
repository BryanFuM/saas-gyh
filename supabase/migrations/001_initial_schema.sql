-- =============================================
-- AGROINVERSIONES BETO - SUPABASE SCHEMA
-- Migración completa con nuevas reglas de negocio
-- =============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

-- Roles de usuario
CREATE TYPE user_role AS ENUM ('ADMIN', 'VENDEDOR', 'INVENTOR');

-- Tipos de venta
CREATE TYPE venta_type AS ENUM ('CAJA', 'PEDIDO');

-- Métodos de pago (NUEVO)
CREATE TYPE payment_method AS ENUM ('EFECTIVO', 'YAPE', 'CREDITO');

-- =============================================
-- TABLA: users
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'VENDEDOR' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: product_types (Tipos configurables)
-- Ej: Kion, Zapallo, Coco, Palillo, Cúrcuma
-- =============================================
CREATE TABLE product_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    has_variants BOOLEAN DEFAULT TRUE, -- Si tiene calidades/variantes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: product_qualities (Calidades/Variantes)
-- Ej: 1, 2, Dedo, Chino, Primera, Segunda
-- =============================================
CREATE TABLE product_qualities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA: products (Catálogo de Productos)
-- Jerarquía: Nombre -> Tipo -> Calidad
-- =============================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,           -- Nombre base: Kion, Zapallo, Coco
    type VARCHAR(100) NOT NULL,           -- Variante/Tipo: Chino, Nacional
    quality VARCHAR(100) NOT NULL,        -- Calidad: 1, 2, Dedo
    conversion_factor INTEGER DEFAULT 17 NOT NULL, -- KG por Java (NUEVO: entero, default 17)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Índice único para evitar duplicados
    UNIQUE(name, type, quality)
);

-- Índices para búsqueda en cascada
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_name_type ON products(name, type);

-- =============================================
-- TABLA: clients (Clientes)
-- Con control de saldo y límite de deuda
-- =============================================
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    whatsapp_number VARCHAR(20),
    current_debt DECIMAL(12, 2) DEFAULT 0.00 NOT NULL,
    credit_limit DECIMAL(12, 2) DEFAULT 1000.00 NOT NULL, -- Límite de crédito (NUEVO)
    days_without_payment INTEGER DEFAULT 0,               -- Días sin pagar (NUEVO)
    last_payment_date TIMESTAMPTZ,                        -- Última fecha de pago (NUEVO)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_debt ON clients(current_debt);

-- =============================================
-- TABLA: client_payments (Pagos/Abonos)
-- =============================================
CREATE TABLE client_payments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method payment_method DEFAULT 'EFECTIVO',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_payments_client ON client_payments(client_id);

-- =============================================
-- TABLA: inventory (Stock por Producto)
-- Unidad principal: JAVAS
-- *** SIN RESTRICCIÓN DE VALORES NEGATIVOS ***
-- =============================================
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_javas DECIMAL(12, 2) DEFAULT 0.00 NOT NULL, -- PUEDE SER NEGATIVO
    average_cost_per_java DECIMAL(12, 2) DEFAULT 0.00,
    last_updated TIMESTAMPTZ DEFAULT NOW()
    
    -- NOTA: NO hay CHECK constraint para permitir stock negativo
);

CREATE INDEX idx_inventory_product ON inventory(product_id);

-- =============================================
-- TABLA: ingreso_lotes (Lotes de Recepción)
-- =============================================
CREATE TABLE ingreso_lotes (
    id SERIAL PRIMARY KEY,
    truck_plate VARCHAR(20) NOT NULL,      -- Placa del camión
    truck_color VARCHAR(50),               -- Color del camión (NUEVO)
    date TIMESTAMPTZ DEFAULT NOW(),
    total_javas DECIMAL(12, 2) DEFAULT 0,
    total_kg DECIMAL(12, 2) DEFAULT 0,
    total_cost DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ingreso_lotes_date ON ingreso_lotes(date);
CREATE INDEX idx_ingreso_lotes_truck ON ingreso_lotes(truck_plate);

-- =============================================
-- TABLA: ingreso_items (Items de Ingreso)
-- NUEVO: Input principal en JAVAS
-- =============================================
CREATE TABLE ingreso_items (
    id SERIAL PRIMARY KEY,
    ingreso_lote_id INTEGER NOT NULL REFERENCES ingreso_lotes(id) ON DELETE CASCADE,
    supplier_name VARCHAR(200) NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    
    -- Cantidades (NUEVO: Javas es el input principal)
    quantity_javas DECIMAL(12, 2) NOT NULL,           -- INPUT PRINCIPAL
    conversion_factor INTEGER DEFAULT 17 NOT NULL,    -- Factor usado
    total_kg DECIMAL(12, 2) NOT NULL,                 -- Calculado: javas * factor
    
    -- Costos (por Java)
    cost_per_java DECIMAL(12, 2) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ingreso_items_lote ON ingreso_items(ingreso_lote_id);
CREATE INDEX idx_ingreso_items_product ON ingreso_items(product_id);

-- =============================================
-- TABLA: ventas (Ventas)
-- Con método de pago, amortización y cliente invitado
-- =============================================
CREATE TABLE ventas (
    id SERIAL PRIMARY KEY,
    date TIMESTAMPTZ DEFAULT NOW(),
    type venta_type NOT NULL,
    
    -- Cliente (nullable para ventas CAJA)
    client_id INTEGER REFERENCES clients(id),
    guest_client_name VARCHAR(200),           -- Nombre para ventas al contado (NUEVO)
    
    -- Usuario que registra
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Totales
    total_amount DECIMAL(12, 2) DEFAULT 0.00 NOT NULL,
    
    -- Método de pago (NUEVO)
    payment_method payment_method DEFAULT 'EFECTIVO' NOT NULL,
    
    -- Amortización (NUEVO) - Pago parcial al momento de la venta
    amortization DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Control de deuda (para PEDIDO)
    previous_debt DECIMAL(12, 2) DEFAULT 0.00,
    new_debt DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Estado
    is_printed BOOLEAN DEFAULT FALSE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ventas_date ON ventas(date);
CREATE INDEX idx_ventas_client ON ventas(client_id);
CREATE INDEX idx_ventas_type ON ventas(type);
CREATE INDEX idx_ventas_payment_method ON ventas(payment_method);

-- =============================================
-- TABLA: venta_items (Items de Venta)
-- =============================================
CREATE TABLE venta_items (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    
    -- Cantidades
    quantity_kg DECIMAL(12, 2) NOT NULL,
    quantity_javas DECIMAL(12, 2) NOT NULL,
    conversion_factor INTEGER NOT NULL,
    
    -- Precios
    price_per_kg DECIMAL(12, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_venta_items_venta ON venta_items(venta_id);
CREATE INDEX idx_venta_items_product ON venta_items(product_id);

-- =============================================
-- TABLA: inventory_adjustments (Ajustes/Mermas)
-- =============================================
CREATE TABLE inventory_adjustments (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity_javas DECIMAL(12, 2) NOT NULL,
    adjustment_type VARCHAR(50) NOT NULL, -- MERMA, ROBO, ERROR_CONTEO, CONSUMO_INTERNO
    reason TEXT,
    cost_impact DECIMAL(12, 2), -- Valorización de la pérdida
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adjustments_product ON inventory_adjustments(product_id);
CREATE INDEX idx_adjustments_type ON inventory_adjustments(adjustment_type);

-- =============================================
-- FUNCIONES Y TRIGGERS
-- =============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ventas_updated_at
    BEFORE UPDATE ON ventas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCIÓN: Actualizar inventario al registrar ingreso
-- =============================================
CREATE OR REPLACE FUNCTION update_inventory_on_ingreso()
RETURNS TRIGGER AS $$
BEGIN
    -- Insertar o actualizar inventario
    INSERT INTO inventory (product_id, quantity_javas, average_cost_per_java, last_updated)
    VALUES (NEW.product_id, NEW.quantity_javas, NEW.cost_per_java, NOW())
    ON CONFLICT (product_id) DO UPDATE SET
        quantity_javas = inventory.quantity_javas + NEW.quantity_javas,
        -- Costo promedio ponderado
        average_cost_per_java = (
            (inventory.quantity_javas * inventory.average_cost_per_java) + 
            (NEW.quantity_javas * NEW.cost_per_java)
        ) / NULLIF(inventory.quantity_javas + NEW.quantity_javas, 0),
        last_updated = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_on_ingreso
    AFTER INSERT ON ingreso_items
    FOR EACH ROW EXECUTE FUNCTION update_inventory_on_ingreso();

-- =============================================
-- FUNCIÓN: Actualizar inventario al registrar venta
-- (Permite stock negativo)
-- =============================================
CREATE OR REPLACE FUNCTION update_inventory_on_venta()
RETURNS TRIGGER AS $$
BEGIN
    -- Restar del inventario (puede resultar en negativo)
    UPDATE inventory 
    SET 
        quantity_javas = quantity_javas - NEW.quantity_javas,
        last_updated = NOW()
    WHERE product_id = NEW.product_id;
    
    -- Si no existe registro de inventario, crear uno negativo
    IF NOT FOUND THEN
        INSERT INTO inventory (product_id, quantity_javas, last_updated)
        VALUES (NEW.product_id, -NEW.quantity_javas, NOW());
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_on_venta
    AFTER INSERT ON venta_items
    FOR EACH ROW EXECUTE FUNCTION update_inventory_on_venta();

-- =============================================
-- FUNCIÓN: Actualizar deuda del cliente al pagar
-- =============================================
CREATE OR REPLACE FUNCTION update_client_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE clients 
    SET 
        current_debt = current_debt - NEW.amount,
        days_without_payment = 0,
        last_payment_date = NOW()
    WHERE id = NEW.client_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_on_payment
    AFTER INSERT ON client_payments
    FOR EACH ROW EXECUTE FUNCTION update_client_on_payment();

-- =============================================
-- VIEWS ÚTILES
-- =============================================

-- Vista de stock disponible con detalles
CREATE OR REPLACE VIEW v_stock_disponible AS
SELECT 
    p.id AS product_id,
    p.name,
    p.type,
    p.quality,
    p.conversion_factor,
    CONCAT(p.name, ' - ', p.type, ' (', p.quality, ')') AS full_name,
    COALESCE(i.quantity_javas, 0) AS stock_javas,
    COALESCE(i.quantity_javas * p.conversion_factor, 0) AS stock_kg,
    COALESCE(i.average_cost_per_java, 0) AS costo_promedio_java,
    CASE 
        WHEN COALESCE(i.quantity_javas, 0) < 0 THEN 'NEGATIVO'
        WHEN COALESCE(i.quantity_javas, 0) < 10 THEN 'BAJO'
        ELSE 'NORMAL'
    END AS estado_stock
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
WHERE p.is_active = TRUE
ORDER BY p.name, p.type, p.quality;

-- Vista de clientes con semáforo de deuda
CREATE OR REPLACE VIEW v_clientes_deuda AS
SELECT 
    c.*,
    CASE 
        WHEN c.current_debt > c.credit_limit THEN 'ROJO'
        WHEN c.current_debt > (c.credit_limit * 0.7) THEN 'AMARILLO'
        ELSE 'VERDE'
    END AS semaforo_deuda,
    CASE 
        WHEN c.current_debt > 1000 THEN TRUE
        ELSE FALSE
    END AS alerta_deuda_alta
FROM clients c
WHERE c.is_active = TRUE
ORDER BY c.current_debt DESC;

-- Vista de productos únicos (para selector en cascada)
CREATE OR REPLACE VIEW v_product_names AS
SELECT DISTINCT name
FROM products
WHERE is_active = TRUE
ORDER BY name;

-- Vista de calidades por producto (para selector en cascada)
CREATE OR REPLACE VIEW v_product_variants AS
SELECT DISTINCT 
    name,
    type,
    quality,
    id AS product_id
FROM products
WHERE is_active = TRUE
ORDER BY name, type, quality;

-- =============================================
-- DATOS INICIALES (Tipos sin variantes)
-- =============================================

-- Productos que NO tienen variantes (Select 2 deshabilitado)
INSERT INTO product_types (name, has_variants) VALUES 
    ('Coco', FALSE),
    ('Zapallo', FALSE),
    ('Palillo', FALSE),
    ('Kion', TRUE),
    ('Cúrcuma', TRUE);

-- Calidades comunes
INSERT INTO product_qualities (name) VALUES 
    ('1'),
    ('2'),
    ('Dedo'),
    ('Chino'),
    ('Nacional'),
    ('Primera'),
    ('Segunda'),
    ('Descarte');

-- =============================================
-- ROW LEVEL SECURITY (RLS) - Opcional
-- =============================================

-- Habilitar RLS en tablas principales
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Política básica: usuarios autenticados pueden leer todo
CREATE POLICY "Users can read all" ON users FOR SELECT USING (true);
CREATE POLICY "Ventas read all" ON ventas FOR SELECT USING (true);
CREATE POLICY "Clients read all" ON clients FOR SELECT USING (true);

-- =============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================

COMMENT ON TABLE products IS 'Catálogo de productos con jerarquía Nombre->Tipo->Calidad';
COMMENT ON COLUMN products.conversion_factor IS 'Kilogramos por Java (default 17)';
COMMENT ON TABLE inventory IS 'Stock actual por producto en JAVAS (permite negativos)';
COMMENT ON COLUMN inventory.quantity_javas IS 'Cantidad actual en javas, puede ser negativo';
COMMENT ON TABLE ventas IS 'Registro de ventas con soporte para pago parcial (amortización)';
COMMENT ON COLUMN ventas.amortization IS 'Monto pagado a cuenta al momento de la venta';
COMMENT ON COLUMN ventas.guest_client_name IS 'Nombre del cliente para ventas al contado sin registro';
COMMENT ON COLUMN clients.credit_limit IS 'Límite de crédito del cliente (default 1000)';
