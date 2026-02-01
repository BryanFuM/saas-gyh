-- =============================================
-- AGROINVERSIONES BETO - FUNCIONES RPC
-- Stored Procedures para operaciones transaccionales
-- =============================================

-- =============================================
-- RPC: crear_venta
-- 
-- Maneja toda la lógica de crear una venta en una sola transacción:
-- 1. Inserta la venta
-- 2. Inserta los items
-- 3. Descuenta el stock (permite negativos)
-- 4. Actualiza la deuda del cliente (si aplica)
-- =============================================

CREATE OR REPLACE FUNCTION crear_venta(
    p_type TEXT,                    -- 'CAJA' o 'PEDIDO'
    p_client_id INTEGER DEFAULT NULL,
    p_guest_client_name TEXT DEFAULT NULL,
    p_user_id UUID,
    p_payment_method TEXT DEFAULT 'EFECTIVO',
    p_amortization DECIMAL DEFAULT 0,
    p_items JSONB                   -- Array de items: [{product_id, quantity_kg, price_per_kg}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_venta_id INTEGER;
    v_total_amount DECIMAL := 0;
    v_previous_debt DECIMAL := 0;
    v_new_debt DECIMAL := 0;
    v_item JSONB;
    v_product RECORD;
    v_quantity_javas DECIMAL;
    v_subtotal DECIMAL;
    v_result JSONB;
BEGIN
    -- Validaciones básicas
    IF p_type NOT IN ('CAJA', 'PEDIDO') THEN
        RAISE EXCEPTION 'Tipo de venta inválido: %', p_type;
    END IF;
    
    IF p_payment_method NOT IN ('EFECTIVO', 'YAPE', 'CREDITO') THEN
        RAISE EXCEPTION 'Método de pago inválido: %', p_payment_method;
    END IF;
    
    IF p_type = 'PEDIDO' AND p_client_id IS NULL THEN
        RAISE EXCEPTION 'Las ventas tipo PEDIDO requieren un cliente';
    END IF;
    
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La venta debe tener al menos un item';
    END IF;

    -- Si es PEDIDO, obtener deuda anterior del cliente
    IF p_type = 'PEDIDO' AND p_client_id IS NOT NULL THEN
        SELECT COALESCE(current_debt, 0) INTO v_previous_debt
        FROM clients
        WHERE id = p_client_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cliente no encontrado: %', p_client_id;
        END IF;
    END IF;

    -- Calcular total de la venta y validar productos
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener datos del producto
        SELECT id, conversion_factor INTO v_product
        FROM products
        WHERE id = (v_item->>'product_id')::INTEGER AND is_active = TRUE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no encontrado o inactivo: %', v_item->>'product_id';
        END IF;
        
        v_subtotal := (v_item->>'quantity_kg')::DECIMAL * (v_item->>'price_per_kg')::DECIMAL;
        v_total_amount := v_total_amount + v_subtotal;
    END LOOP;

    -- Calcular nueva deuda
    -- Fórmula: (Deuda Anterior + Venta Actual) - Amortización
    IF p_type = 'PEDIDO' THEN
        v_new_debt := GREATEST(0, (v_previous_debt + v_total_amount) - COALESCE(p_amortization, 0));
    END IF;

    -- 1. INSERTAR VENTA
    INSERT INTO ventas (
        type, 
        client_id, 
        guest_client_name,
        user_id, 
        total_amount, 
        payment_method,
        amortization,
        previous_debt,
        new_debt
    )
    VALUES (
        p_type::venta_type, 
        p_client_id, 
        p_guest_client_name,
        p_user_id, 
        v_total_amount, 
        p_payment_method::payment_method,
        COALESCE(p_amortization, 0),
        v_previous_debt,
        v_new_debt
    )
    RETURNING id INTO v_venta_id;

    -- 2. INSERTAR ITEMS Y DESCONTAR STOCK
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener factor de conversión del producto
        SELECT conversion_factor INTO v_product
        FROM products
        WHERE id = (v_item->>'product_id')::INTEGER;
        
        -- Calcular javas
        v_quantity_javas := (v_item->>'quantity_kg')::DECIMAL / v_product.conversion_factor;
        v_subtotal := (v_item->>'quantity_kg')::DECIMAL * (v_item->>'price_per_kg')::DECIMAL;
        
        -- Insertar item de venta
        INSERT INTO venta_items (
            venta_id,
            product_id,
            quantity_kg,
            quantity_javas,
            conversion_factor,
            price_per_kg,
            subtotal
        )
        VALUES (
            v_venta_id,
            (v_item->>'product_id')::INTEGER,
            (v_item->>'quantity_kg')::DECIMAL,
            v_quantity_javas,
            v_product.conversion_factor,
            (v_item->>'price_per_kg')::DECIMAL,
            v_subtotal
        );
        
        -- 3. DESCONTAR STOCK (permite negativos)
        -- Intentar actualizar, si no existe crear con valor negativo
        UPDATE inventory 
        SET 
            quantity_javas = quantity_javas - v_quantity_javas,
            last_updated = NOW()
        WHERE product_id = (v_item->>'product_id')::INTEGER;
        
        IF NOT FOUND THEN
            -- Si no existe registro de inventario, crearlo con valor negativo
            INSERT INTO inventory (product_id, quantity_javas, last_updated)
            VALUES ((v_item->>'product_id')::INTEGER, -v_quantity_javas, NOW());
        END IF;
    END LOOP;

    -- 4. ACTUALIZAR DEUDA DEL CLIENTE (solo para PEDIDO)
    IF p_type = 'PEDIDO' AND p_client_id IS NOT NULL THEN
        UPDATE clients
        SET 
            current_debt = v_new_debt,
            updated_at = NOW()
        WHERE id = p_client_id;
        
        -- Si hubo amortización, registrar el pago
        IF p_amortization > 0 THEN
            INSERT INTO client_payments (client_id, amount, payment_method, notes)
            VALUES (
                p_client_id, 
                p_amortization, 
                p_payment_method::payment_method,
                'Pago a cuenta en venta #' || v_venta_id
            );
        END IF;
    END IF;

    -- Construir resultado
    SELECT jsonb_build_object(
        'success', true,
        'venta_id', v_venta_id,
        'total_amount', v_total_amount,
        'previous_debt', v_previous_debt,
        'amortization', COALESCE(p_amortization, 0),
        'new_debt', v_new_debt,
        'message', 'Venta registrada exitosamente'
    ) INTO v_result;
    
    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, la transacción se revierte automáticamente
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
END;
$$;

-- Dar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION crear_venta TO authenticated;
GRANT EXECUTE ON FUNCTION crear_venta TO anon;

-- =============================================
-- RPC: crear_ingreso
-- 
-- Maneja toda la lógica de crear un ingreso en una sola transacción:
-- 1. Inserta el lote de ingreso
-- 2. Inserta los items
-- 3. Actualiza el inventario (suma stock y recalcula costo promedio)
-- =============================================

CREATE OR REPLACE FUNCTION crear_ingreso(
    p_truck_plate TEXT,
    p_truck_color TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_items JSONB                   -- Array: [{supplier_name, product_id, quantity_javas, conversion_factor, cost_per_java}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lote_id INTEGER;
    v_total_javas DECIMAL := 0;
    v_total_kg DECIMAL := 0;
    v_total_cost DECIMAL := 0;
    v_item JSONB;
    v_product RECORD;
    v_item_total_kg DECIMAL;
    v_item_total_cost DECIMAL;
    v_current_stock DECIMAL;
    v_current_avg_cost DECIMAL;
    v_new_avg_cost DECIMAL;
    v_result JSONB;
BEGIN
    -- Validaciones básicas
    IF p_truck_plate IS NULL OR p_truck_plate = '' THEN
        RAISE EXCEPTION 'La placa del camión es requerida';
    END IF;
    
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El ingreso debe tener al menos un item';
    END IF;

    -- Calcular totales y validar productos
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Validar producto existe
        SELECT id, conversion_factor INTO v_product
        FROM products
        WHERE id = (v_item->>'product_id')::INTEGER AND is_active = TRUE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no encontrado o inactivo: %', v_item->>'product_id';
        END IF;
        
        -- Usar el factor del item o el del producto
        v_item_total_kg := (v_item->>'quantity_javas')::DECIMAL * 
                           COALESCE((v_item->>'conversion_factor')::DECIMAL, v_product.conversion_factor);
        v_item_total_cost := (v_item->>'quantity_javas')::DECIMAL * (v_item->>'cost_per_java')::DECIMAL;
        
        v_total_javas := v_total_javas + (v_item->>'quantity_javas')::DECIMAL;
        v_total_kg := v_total_kg + v_item_total_kg;
        v_total_cost := v_total_cost + v_item_total_cost;
    END LOOP;

    -- 1. INSERTAR LOTE DE INGRESO
    INSERT INTO ingreso_lotes (
        truck_plate,
        truck_color,
        total_javas,
        total_kg,
        total_cost,
        notes,
        created_by
    )
    VALUES (
        UPPER(TRIM(p_truck_plate)),
        p_truck_color,
        v_total_javas,
        v_total_kg,
        v_total_cost,
        p_notes,
        p_user_id
    )
    RETURNING id INTO v_lote_id;

    -- 2. INSERTAR ITEMS Y ACTUALIZAR INVENTARIO
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Calcular valores del item
        v_item_total_kg := (v_item->>'quantity_javas')::DECIMAL * 
                           COALESCE((v_item->>'conversion_factor')::DECIMAL, 17);
        v_item_total_cost := (v_item->>'quantity_javas')::DECIMAL * (v_item->>'cost_per_java')::DECIMAL;
        
        -- Insertar item
        INSERT INTO ingreso_items (
            ingreso_lote_id,
            supplier_name,
            product_id,
            quantity_javas,
            conversion_factor,
            total_kg,
            cost_per_java,
            total_cost
        )
        VALUES (
            v_lote_id,
            TRIM((v_item->>'supplier_name')::TEXT),
            (v_item->>'product_id')::INTEGER,
            (v_item->>'quantity_javas')::DECIMAL,
            COALESCE((v_item->>'conversion_factor')::DECIMAL, 17),
            v_item_total_kg,
            (v_item->>'cost_per_java')::DECIMAL,
            v_item_total_cost
        );
        
        -- 3. ACTUALIZAR INVENTARIO
        -- Obtener stock actual
        SELECT quantity_javas, average_cost_per_java 
        INTO v_current_stock, v_current_avg_cost
        FROM inventory
        WHERE product_id = (v_item->>'product_id')::INTEGER;
        
        IF FOUND THEN
            -- Calcular nuevo costo promedio ponderado
            IF (v_current_stock + (v_item->>'quantity_javas')::DECIMAL) > 0 THEN
                v_new_avg_cost := (
                    (v_current_stock * COALESCE(v_current_avg_cost, 0)) + 
                    ((v_item->>'quantity_javas')::DECIMAL * (v_item->>'cost_per_java')::DECIMAL)
                ) / (v_current_stock + (v_item->>'quantity_javas')::DECIMAL);
            ELSE
                v_new_avg_cost := (v_item->>'cost_per_java')::DECIMAL;
            END IF;
            
            -- Actualizar inventario existente
            UPDATE inventory 
            SET 
                quantity_javas = quantity_javas + (v_item->>'quantity_javas')::DECIMAL,
                average_cost_per_java = v_new_avg_cost,
                last_updated = NOW()
            WHERE product_id = (v_item->>'product_id')::INTEGER;
        ELSE
            -- Crear nuevo registro de inventario
            INSERT INTO inventory (
                product_id, 
                quantity_javas, 
                average_cost_per_java,
                last_updated
            )
            VALUES (
                (v_item->>'product_id')::INTEGER,
                (v_item->>'quantity_javas')::DECIMAL,
                (v_item->>'cost_per_java')::DECIMAL,
                NOW()
            );
        END IF;
    END LOOP;

    -- Construir resultado
    SELECT jsonb_build_object(
        'success', true,
        'lote_id', v_lote_id,
        'total_javas', v_total_javas,
        'total_kg', v_total_kg,
        'total_cost', v_total_cost,
        'items_count', jsonb_array_length(p_items),
        'message', 'Ingreso registrado exitosamente'
    ) INTO v_result;
    
    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
END;
$$;

-- Dar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION crear_ingreso TO authenticated;
GRANT EXECUTE ON FUNCTION crear_ingreso TO anon;

-- =============================================
-- RPC: registrar_pago_cliente
-- 
-- Registra un pago/abono de un cliente
-- =============================================

CREATE OR REPLACE FUNCTION registrar_pago_cliente(
    p_client_id INTEGER,
    p_amount DECIMAL,
    p_payment_method TEXT DEFAULT 'EFECTIVO',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_debt DECIMAL;
    v_new_debt DECIMAL;
    v_payment_id INTEGER;
    v_result JSONB;
BEGIN
    -- Validaciones
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser mayor a 0';
    END IF;
    
    -- Obtener deuda actual
    SELECT current_debt INTO v_current_debt
    FROM clients
    WHERE id = p_client_id AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente no encontrado: %', p_client_id;
    END IF;
    
    -- Calcular nueva deuda (no puede ser negativa)
    v_new_debt := GREATEST(0, v_current_debt - p_amount);
    
    -- Registrar pago
    INSERT INTO client_payments (client_id, amount, payment_method, notes)
    VALUES (p_client_id, p_amount, p_payment_method::payment_method, p_notes)
    RETURNING id INTO v_payment_id;
    
    -- Actualizar cliente
    UPDATE clients
    SET 
        current_debt = v_new_debt,
        days_without_payment = 0,
        last_payment_date = NOW(),
        updated_at = NOW()
    WHERE id = p_client_id;
    
    -- Resultado
    SELECT jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'previous_debt', v_current_debt,
        'amount_paid', p_amount,
        'new_debt', v_new_debt,
        'message', 'Pago registrado exitosamente'
    ) INTO v_result;
    
    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_pago_cliente TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_pago_cliente TO anon;

-- =============================================
-- RPC: obtener_resumen_diario
-- 
-- Obtiene el resumen de ventas del día
-- =============================================

CREATE OR REPLACE FUNCTION obtener_resumen_diario(p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'fecha', p_fecha,
        'ventas_efectivo', COALESCE(SUM(CASE WHEN payment_method = 'EFECTIVO' THEN total_amount END), 0),
        'ventas_yape', COALESCE(SUM(CASE WHEN payment_method = 'YAPE' THEN total_amount END), 0),
        'ventas_credito', COALESCE(SUM(CASE WHEN payment_method = 'CREDITO' THEN total_amount END), 0),
        'total_ventas', COALESCE(SUM(total_amount), 0),
        'cantidad_ventas', COUNT(*),
        'ventas_caja', COUNT(CASE WHEN type = 'CAJA' THEN 1 END),
        'ventas_pedido', COUNT(CASE WHEN type = 'PEDIDO' THEN 1 END),
        'total_amortizaciones', COALESCE(SUM(amortization), 0)
    ) INTO v_result
    FROM ventas
    WHERE DATE(date) = p_fecha
    AND is_cancelled = FALSE;
    
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_resumen_diario TO authenticated;
GRANT EXECUTE ON FUNCTION obtener_resumen_diario TO anon;

-- =============================================
-- COMENTARIOS
-- =============================================

COMMENT ON FUNCTION crear_venta IS 'Crea una venta completa en una sola transacción atómica. Inserta venta, items, descuenta stock y actualiza deuda del cliente.';
COMMENT ON FUNCTION crear_ingreso IS 'Crea un ingreso de mercadería completo. Inserta lote, items y actualiza inventario con costo promedio ponderado.';
COMMENT ON FUNCTION registrar_pago_cliente IS 'Registra un pago de cliente y actualiza su deuda.';
COMMENT ON FUNCTION obtener_resumen_diario IS 'Obtiene estadísticas de ventas del día.';
