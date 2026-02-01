-- =============================================================================
-- 🧹 AGRO BETO - RESET Y SEED DATABASE
-- =============================================================================
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Autor: Tech Lead Cleanup Script
-- Fecha: Enero 2026
-- =============================================================================

-- ============================================
-- PARTE 1: RESET - LIMPIAR DATOS EXISTENTES
-- ============================================
-- IMPORTANTE: Ejecutar en orden para respetar foreign keys

-- 1. Vaciar tablas de transacciones (dependientes)
TRUNCATE TABLE venta_items CASCADE;
TRUNCATE TABLE ventas CASCADE;
TRUNCATE TABLE ingreso_items CASCADE;
TRUNCATE TABLE ingreso_lotes CASCADE;

-- 2. Vaciar tabla de pagos de clientes
TRUNCATE TABLE client_payments CASCADE;

-- 3. Vaciar inventario y movimientos
TRUNCATE TABLE inventory_movements CASCADE;
TRUNCATE TABLE inventory CASCADE;

-- 4. Vaciar clientes (pero mantener products, types, qualities)
TRUNCATE TABLE clients CASCADE;

-- 5. Limpiar tipos y calidades para insertar los oficiales
TRUNCATE TABLE product_types CASCADE;
TRUNCATE TABLE product_qualities CASCADE;

-- 6. Limpiar productos (para insertar los oficiales)
TRUNCATE TABLE products CASCADE;

-- Resetear sequences (IDs empezarán desde 1)
ALTER SEQUENCE IF EXISTS products_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS clients_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS ventas_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS venta_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS ingreso_lotes_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS ingreso_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS inventory_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS inventory_movements_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS client_payments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS product_types_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS product_qualities_id_seq RESTART WITH 1;


-- ============================================
-- PARTE 2: SEED - DATOS MAESTROS AGRO BETO
-- ============================================

-- 2.1 TIPOS DE PRODUCTO (Categorías)
INSERT INTO product_types (name) VALUES
  ('Coco'),
  ('Zapallo'),
  ('Palillo'),
  ('Manzana'),
  ('Kion Común'),
  ('Kion Chino');

-- 2.2 CALIDADES DE PRODUCTO
INSERT INTO product_qualities (name) VALUES
  ('Sin Clasificar'),  -- Para productos sin variante
  ('1'),
  ('2'),
  ('3'),
  ('4'),
  ('5'),
  ('Dedo'),
  ('Bola');

-- 2.3 PRODUCTOS MAESTROS
-- Productos SIN variantes (factor: 17 kg/java)
INSERT INTO products (name, type, quality, conversion_factor, is_active) VALUES
  ('Coco', 'Coco', 'Sin Clasificar', 17, true),
  ('Zapallo', 'Zapallo', 'Sin Clasificar', 17, true),
  ('Palillo', 'Palillo', 'Sin Clasificar', 17, true);

-- Manzana: Variantes 1, 2, 3, 4
INSERT INTO products (name, type, quality, conversion_factor, is_active) VALUES
  ('Manzana', 'Manzana', '1', 20, true),
  ('Manzana', 'Manzana', '2', 20, true),
  ('Manzana', 'Manzana', '3', 20, true),
  ('Manzana', 'Manzana', '4', 20, true);

-- Kion Común: Variantes 1, 3, 5, Dedo
INSERT INTO products (name, type, quality, conversion_factor, is_active) VALUES
  ('Kion Común', 'Kion Común', '1', 20, true),
  ('Kion Común', 'Kion Común', '3', 20, true),
  ('Kion Común', 'Kion Común', '5', 20, true),
  ('Kion Común', 'Kion Común', 'Dedo', 20, true);

-- Kion Chino: Variantes 1, 2, 3, 5, Dedo, Bola
INSERT INTO products (name, type, quality, conversion_factor, is_active) VALUES
  ('Kion Chino', 'Kion Chino', '1', 20, true),
  ('Kion Chino', 'Kion Chino', '2', 20, true),
  ('Kion Chino', 'Kion Chino', '3', 20, true),
  ('Kion Chino', 'Kion Chino', '5', 20, true),
  ('Kion Chino', 'Kion Chino', 'Dedo', 20, true),
  ('Kion Chino', 'Kion Chino', 'Bola', 20, true);


-- ============================================
-- PARTE 3: DATOS DE PRUEBA
-- ============================================

-- 3.1 CLIENTES DE PRUEBA
INSERT INTO clients (name, whatsapp_number, current_debt, credit_limit, is_active) VALUES
  ('Distribuidora El Sol', '999111222', 0, 5000, true),
  ('Mercado Central', '999333444', 500, 3000, true);

-- 3.2 STOCK INICIAL (Inventory)
-- Necesitamos los IDs de los productos, los obtenemos dinámicamente

-- Insertar stock para "Kion Chino - Calidad 1" (100 javas, costo 50 soles/java)
INSERT INTO inventory (product_id, quantity_javas, average_cost_per_java)
SELECT id, 100, 50.00
FROM products 
WHERE name = 'Kion Chino' AND quality = '1';

-- Insertar stock para "Zapallo" (50 javas, costo 30 soles/java)
INSERT INTO inventory (product_id, quantity_javas, average_cost_per_java)
SELECT id, 50, 30.00
FROM products 
WHERE name = 'Zapallo';

-- 3.3 MOVIMIENTOS INICIALES DE INVENTARIO (para historial)
INSERT INTO inventory_movements (product_id, movement_type, quantity_javas, unit_cost, reference_type, notes)
SELECT id, 'INGRESO', 100, 50.00, 'SEED', 'Stock inicial de prueba'
FROM products 
WHERE name = 'Kion Chino' AND quality = '1';

INSERT INTO inventory_movements (product_id, movement_type, quantity_javas, unit_cost, reference_type, notes)
SELECT id, 'INGRESO', 50, 30.00, 'SEED', 'Stock inicial de prueba'
FROM products 
WHERE name = 'Zapallo';


-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Ejecuta estas queries para verificar:

-- Ver productos creados
SELECT id, name, type, quality, conversion_factor 
FROM products 
WHERE is_active = true
ORDER BY name, quality;

-- Ver clientes
SELECT id, name, current_debt, credit_limit 
FROM clients;

-- Ver stock inicial
SELECT 
  p.name,
  p.type,
  p.quality,
  i.quantity_javas,
  i.average_cost_per_java
FROM inventory i
JOIN products p ON i.product_id = p.id
ORDER BY p.name;

-- Ver tipos y calidades
SELECT 'Tipos:' as categoria, name FROM product_types
UNION ALL
SELECT 'Calidades:', name FROM product_qualities;



