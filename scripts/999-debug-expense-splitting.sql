-- Script de diagnóstico para el sistema de división de gastos
-- Ejecutar este script para ver qué datos hay y identificar problemas

-- 1. Verificar si las tablas existen
SELECT 'Tabla trip_expenses existe' as diagnostico, count(*) as registros 
FROM trip_expenses 
WHERE split_type IS NOT NULL;

SELECT 'Tabla expense_splits existe' as diagnostico, count(*) as registros 
FROM expense_splits;

-- 2. Ver gastos con división
SELECT 
  te.id,
  te.title,
  te.amount,
  te.paid_by,
  te.split_type,
  te.is_settlement,
  te.created_at
FROM trip_expenses te 
WHERE te.paid_by IS NOT NULL
ORDER BY te.created_at DESC
LIMIT 5;

-- 3. Ver expense_splits existentes
SELECT 
  es.expense_id,
  es.user_id,
  es.amount,
  es.paid,
  p.email as user_email
FROM expense_splits es
LEFT JOIN profiles p ON es.user_id = p.id
ORDER BY es.created_at DESC
LIMIT 5;

-- 4. Verificar si las funciones RPC existen
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name IN ('get_trip_balances', 'get_trip_expenses_with_splits', 'get_trip_members_for_expense')
  AND routine_schema = 'public';

-- 5. Prueba de función get_trip_balances (necesitas reemplazar los UUIDs)
-- SELECT * FROM get_trip_balances('tu-trip-id-aquí', 'tu-user-id-aquí'); 