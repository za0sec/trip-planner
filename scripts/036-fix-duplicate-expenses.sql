-- Script para limpiar gastos divididos duplicados
-- Identifica gastos con el mismo título base pero diferentes sufijos y elimina duplicados

-- PASO 1: Identificar gastos potencialmente duplicados
-- Esto es solo para revisar, no hace cambios

SELECT 
  te.id,
  te.title,
  te.amount,
  te.created_at,
  te.created_by,
  -- Extraer título base quitando sufijos
  CASE 
    WHEN te.title LIKE '% (Planificación)' THEN REPLACE(te.title, ' (Planificación)', '')
    WHEN te.title LIKE '% (Dividido)' THEN REPLACE(te.title, ' (Dividido)', '')
    ELSE te.title
  END as base_title,
  COUNT(*) OVER (
    PARTITION BY 
      trip_id,
      CASE 
        WHEN te.title LIKE '% (Planificación)' THEN REPLACE(te.title, ' (Planificación)', '')
        WHEN te.title LIKE '% (Dividido)' THEN REPLACE(te.title, ' (Dividido)', '')
        ELSE te.title
      END
  ) as duplicate_count
FROM trip_expenses te
WHERE (te.title LIKE '% (Planificación)' OR te.title LIKE '% (Dividido)')
  AND te.is_settlement = FALSE
ORDER BY 
  te.trip_id,
  base_title,
  te.created_at DESC;

-- PASO 2: Función para eliminar duplicados (mantener el más reciente)
-- EJECUTAR SOLO DESPUÉS DE REVISAR LOS RESULTADOS DEL PASO 1

DO $$
DECLARE
  expense_record RECORD;
  duplicate_count INTEGER;
  expenses_to_delete UUID[];
BEGIN
  -- Buscar grupos de gastos duplicados
  FOR expense_record IN 
    SELECT 
      trip_id,
      CASE 
        WHEN title LIKE '% (Planificación)' THEN REPLACE(title, ' (Planificación)', '')
        WHEN title LIKE '% (Dividido)' THEN REPLACE(title, ' (Dividido)', '')
        ELSE title
      END as base_title,
      COUNT(*) as dup_count
    FROM trip_expenses 
    WHERE (title LIKE '% (Planificación)' OR title LIKE '% (Dividido)')
      AND is_settlement = FALSE
    GROUP BY 
      trip_id,
      CASE 
        WHEN title LIKE '% (Planificación)' THEN REPLACE(title, ' (Planificación)', '')
        WHEN title LIKE '% (Dividido)' THEN REPLACE(title, ' (Dividido)', '')
        ELSE title
      END
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Found % duplicates for base title: % in trip %', 
      expense_record.dup_count, expense_record.base_title, expense_record.trip_id;
    
    -- Obtener IDs de gastos duplicados (todos excepto el más reciente)
    SELECT ARRAY(
      SELECT id 
      FROM trip_expenses 
      WHERE trip_id = expense_record.trip_id
        AND (
          title = expense_record.base_title || ' (Planificación)' OR
          title = expense_record.base_title || ' (Dividido)'
        )
        AND is_settlement = FALSE
      ORDER BY created_at DESC
      OFFSET 1  -- Mantener el más reciente, eliminar el resto
    ) INTO expenses_to_delete;
    
    -- Eliminar expense_splits primero (por foreign key)
    DELETE FROM expense_splits 
    WHERE expense_id = ANY(expenses_to_delete);
    
    -- Eliminar los gastos duplicados
    DELETE FROM trip_expenses 
    WHERE id = ANY(expenses_to_delete);
    
    RAISE NOTICE 'Deleted % duplicate expenses for: %', 
      array_length(expenses_to_delete, 1), expense_record.base_title;
  END LOOP;
END $$;

-- PASO 3: Verificar que ya no hay duplicados
SELECT 
  'After cleanup' as status,
  COUNT(*) as total_divided_expenses,
  COUNT(DISTINCT CASE 
    WHEN title LIKE '% (Planificación)' THEN REPLACE(title, ' (Planificación)', '')
    WHEN title LIKE '% (Dividido)' THEN REPLACE(title, ' (Dividido)', '')
    ELSE title
  END) as unique_activities_with_expenses
FROM trip_expenses 
WHERE (title LIKE '% (Planificación)' OR title LIKE '% (Dividido)')
  AND is_settlement = FALSE; 