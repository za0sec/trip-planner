-- Arreglar funciones RPC para incluir al owner del viaje en los balances y divisiones
-- Este script corrige el problema donde el owner no aparece en los balances

-- Función corregida para obtener miembros de un viaje (incluye owner)
CREATE OR REPLACE FUNCTION get_trip_members_for_expense(p_trip_id UUID, p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar si el usuario tiene acceso al viaje
  IF NOT EXISTS (
    SELECT 1 FROM trips WHERE id = p_trip_id AND created_by = p_user_id
    UNION
    SELECT 1 FROM trip_members WHERE trip_id = p_trip_id AND user_id = p_user_id AND status = 'accepted'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Incluir al owner del viaje
  SELECT 
    t.created_by as user_id,
    p.email,
    p.full_name,
    p.avatar_url,
    'owner'::TEXT as role
  FROM trips t
  INNER JOIN profiles p ON t.created_by = p.id
  WHERE t.id = p_trip_id
  
  UNION
  
  -- Incluir a los miembros del viaje
  SELECT 
    tm.user_id,
    p.email,
    p.full_name,
    p.avatar_url,
    tm.role
  FROM trip_members tm
  INNER JOIN profiles p ON tm.user_id = p.id
  WHERE tm.trip_id = p_trip_id 
    AND tm.status = 'accepted'
  ORDER BY full_name, email;
END;
$$;

-- Función corregida para obtener balances (incluye owner)
CREATE OR REPLACE FUNCTION get_trip_balances(p_trip_id UUID, p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    total_paid DECIMAL(10,2),
    total_owed DECIMAL(10,2),
    balance DECIMAL(10,2) -- positivo = le deben, negativo = debe
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar si el usuario tiene acceso al viaje
  IF NOT EXISTS (
    SELECT 1 FROM trips WHERE id = p_trip_id AND created_by = p_user_id
    UNION
    SELECT 1 FROM trip_members WHERE trip_id = p_trip_id AND user_id = p_user_id AND status = 'accepted'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH user_payments AS (
    -- Lo que cada usuario ha pagado
    SELECT 
      te.paid_by as user_id,
      COALESCE(SUM(te.amount), 0) as total_paid
    FROM trip_expenses te
    WHERE te.trip_id = p_trip_id 
      AND te.paid_by IS NOT NULL
      AND te.is_settlement = FALSE
    GROUP BY te.paid_by
  ),
  user_debts AS (
    -- Lo que cada usuario debe (sum de sus expense_splits)
    SELECT 
      es.user_id,
      COALESCE(SUM(es.amount), 0) as total_owed
    FROM expense_splits es
    INNER JOIN trip_expenses te ON es.expense_id = te.id
    WHERE te.trip_id = p_trip_id
      AND te.is_settlement = FALSE
    GROUP BY es.user_id
  ),
  all_users AS (
    -- Incluir al owner del viaje
    SELECT 
      t.created_by as user_id,
      p.email,
      p.full_name,
      p.avatar_url
    FROM trips t
    INNER JOIN profiles p ON t.created_by = p.id
    WHERE t.id = p_trip_id
    
    UNION
    
    -- Incluir a los miembros del viaje (evitar duplicados con DISTINCT)
    SELECT DISTINCT
      tm.user_id,
      p.email,
      p.full_name,
      p.avatar_url
    FROM trip_members tm
    INNER JOIN profiles p ON tm.user_id = p.id
    WHERE tm.trip_id = p_trip_id 
      AND tm.status = 'accepted'
  )
  SELECT 
    au.user_id,
    au.email,
    au.full_name,
    au.avatar_url,
    COALESCE(up.total_paid, 0) as total_paid,
    COALESCE(ud.total_owed, 0) as total_owed,
    COALESCE(up.total_paid, 0) - COALESCE(ud.total_owed, 0) as balance
  FROM all_users au
  LEFT JOIN user_payments up ON au.user_id = up.user_id
  LEFT JOIN user_debts ud ON au.user_id = ud.user_id
  WHERE COALESCE(up.total_paid, 0) > 0 OR COALESCE(ud.total_owed, 0) > 0 -- Solo mostrar usuarios con actividad
  ORDER BY au.full_name, au.email;
END;
$$; 