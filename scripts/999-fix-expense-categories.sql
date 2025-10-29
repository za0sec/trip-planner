-- Script para asignar categorías a gastos divididos existentes
-- basándose en el título de la actividad original

-- Primero, veamos cuántos gastos tienen category_id null
SELECT 
  COUNT(*) as gastos_sin_categoria,
  COUNT(CASE WHEN title LIKE '%(Planificación)%' OR title LIKE '%(Dividido)%' THEN 1 END) as gastos_divididos_sin_categoria
FROM trip_expenses 
WHERE category_id IS NULL;

-- Ahora vamos a actualizar los gastos divididos basándonos en las actividades
-- Creamos un mapeo temporal de categorías
WITH activity_categories AS (
  SELECT 
    title,
    category,
    CASE 
      WHEN category = 'flight' THEN 'Vuelos'
      WHEN category = 'accommodation' THEN 'Alojamiento'
      WHEN category = 'transport' THEN 'Transporte'
      WHEN category = 'food' THEN 'Comida'
      WHEN category = 'activity' THEN 'Actividades'
      WHEN category = 'shopping' THEN 'Compras'
      WHEN category = 'other' THEN 'Otros'
      ELSE NULL
    END as expense_category_name
  FROM activities
  WHERE category IS NOT NULL
),
category_ids AS (
  SELECT id, name FROM categories
)

-- Actualizar gastos que tienen "(Planificación)" en el título
UPDATE trip_expenses te
SET category_id = ci.id
FROM activity_categories ac
INNER JOIN category_ids ci ON ac.expense_category_name = ci.name
WHERE 
  te.category_id IS NULL 
  AND (
    te.title = ac.title || ' (Planificación)' OR
    te.title = ac.title || ' (Dividido)'
  );

-- Verificar cuántos gastos se actualizaron
SELECT 
  COUNT(*) as gastos_actualizados
FROM trip_expenses 
WHERE category_id IS NOT NULL;

-- Mostrar resumen por categoría
SELECT 
  c.name as categoria,
  COUNT(te.id) as cantidad_gastos,
  SUM(te.amount) as total_monto
FROM trip_expenses te
LEFT JOIN categories c ON te.category_id = c.id
GROUP BY c.name
ORDER BY cantidad_gastos DESC;

-- Mostrar gastos que aún no tienen categoría
SELECT 
  id,
  title,
  amount,
  created_at
FROM trip_expenses 
WHERE category_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

