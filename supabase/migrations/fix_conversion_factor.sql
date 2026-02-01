-- =============================================================================
-- FIX FACTOR DE CONVERSIÓN DECIMAL
-- =============================================================================
-- Autor: DevOps Cleanup
-- Fecha: Febrero 2026
-- Objetivo: Permitir decimales en el factor de conversión (ej: 18.6 kg/java)
-- Problema: Actualmente la columna es INTEGER y rechaza decimales.
-- =============================================================================

-- 1. Tabla: products
-- Cambiar conversion_factor de INTEGER a NUMERIC(10,2) para permitir decimales
ALTER TABLE products 
ALTER COLUMN conversion_factor TYPE NUMERIC(10, 2);

-- 2. Tabla: ingreso_items
-- Cambiar conversion_factor de INTEGER a NUMERIC(10,2)
ALTER TABLE ingreso_items 
ALTER COLUMN conversion_factor TYPE NUMERIC(10, 2);

-- 3. Tabla: venta_items (Si existe y tiene conversion_factor, confirmar schema primero)
-- Solo ejecutar si esta columna existe en tu schema de ventas, si no, ignorar.
-- (Basado en el contexto previo, venta_items tiene quantity_javas y subtotal, 
--  no suele tener conversion_factor explícito salvo snapshot, 
--  pero si lo tiene, descomenta la siguiente línea):
-- ALTER TABLE venta_items ALTER COLUMN conversion_factor TYPE NUMERIC(10, 2);

-- 4. Verificar cambio
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE column_name = 'conversion_factor' 
  AND table_name IN ('products', 'ingreso_items');
