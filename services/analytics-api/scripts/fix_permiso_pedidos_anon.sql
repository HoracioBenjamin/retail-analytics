-- Fix: HTTP 401 / PERMISSION_DENIED al leer 'pedidos'
-- ---------------------------------------------------------------
-- Síntoma: {'code': '42501', 'message': 'permission denied for table
--          pedidos'} (consultado vía PostgREST con clave publishable).
-- Causa: el rol anon NO tiene GRANT SELECT sobre public.pedidos.
--        Sí existen permisos en productos, stock, colores, categorias,
--        marcas y detalles_pedido. Además, lineas_venta() consulta
--        detalles_pedido con embed pedidos!inner(...) → requiere
--        también VISIBLE la tabla pedidos.
-- Solución: ejecutar con el rol postgres (SQL Editor del Dashboard).
--          Es solo-lectura (SELECT) y no expone datos personales por
--          sí solo; el embed trae created_at / fecha_pago / estado.


-- 1) Permiso de lectura de la tabla para el rol anon
GRANT SELECT ON public.pedidos TO anon;


-- 2) Si RLS está activado en la tabla, permitir SELECT a anon.
--    IMPORTANTE: un GRANT sin política RLS activa NO devuelve error,
--    solo devuelve 0 filas. Por eso se agrega la política.
--    CREATE POLICY no soporta IF NOT EXISTS → DO block.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'pedidos'
          AND c.relrowsecurity
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'pedidos'
              AND policyname = 'lectura_anon_pedidos'
        ) THEN
            EXECUTE 'CREATE POLICY lectura_anon_pedidos
                     ON public.pedidos
                     FOR SELECT
                     TO anon
                     USING (true)';
        END IF;
    END IF;
END $$;
