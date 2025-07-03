-- Agregar sistema de división de gastos tipo Splitwise
-- Permite dividir gastos entre miembros del viaje y rastrear quién debe a quién

-- Tabla para rastrear las divisiones de cada gasto
CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES trip_expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, -- Cantidad que le corresponde a este usuario
  paid BOOLEAN DEFAULT FALSE, -- Si este usuario ya pagó su parte
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(expense_id, user_id)
);

-- Agregar campos a trip_expenses para rastrear quién pagó
ALTER TABLE trip_expenses 
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS split_type TEXT DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom', 'percentage', 'shares')),
ADD COLUMN IF NOT EXISTS is_settlement BOOLEAN DEFAULT FALSE; -- Para pagos de deudas entre usuarios

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_id ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_paid_by ON trip_expenses(paid_by);

-- Función para obtener miembros de un viaje (para usar en el diálogo de división)
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

-- Función para obtener el balance de deudas de un usuario en un viaje
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
    
    -- Incluir a los miembros del viaje
    SELECT 
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
  ORDER BY au.full_name, au.email;
END;
$$;

-- Función para obtener gastos con sus divisiones
CREATE OR REPLACE FUNCTION get_trip_expenses_with_splits(p_trip_id UUID, p_user_id UUID)
RETURNS TABLE (
  -- Campos del gasto
  id UUID,
  trip_id UUID,
  category_id UUID,
  title TEXT,
  description TEXT,
  amount DECIMAL(10,2),
  currency TEXT,
  purchase_date DATE,
  location TEXT,
  status TEXT,
  receipt_url TEXT,
  notes TEXT,
  image_url TEXT,
  paid_by UUID,
  split_type TEXT,
  is_settlement BOOLEAN,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  -- Información de categoría
  category_name TEXT,
  category_icon TEXT,
  category_color TEXT,
  -- Información de quién pagó
  paid_by_name TEXT,
  paid_by_email TEXT,
  -- Información de divisiones (como JSON array)
  splits JSONB
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
  SELECT 
    te.id,
    te.trip_id,
    te.category_id,
    te.title,
    te.description,
    te.amount,
    te.currency,
    te.purchase_date,
    te.location,
    te.status,
    te.receipt_url,
    te.notes,
    te.image_url,
    te.paid_by,
    te.split_type,
    te.is_settlement,
    te.created_by,
    te.created_at,
    c.name as category_name,
    c.icon as category_icon,
    c.color as category_color,
    payer.full_name as paid_by_name,
    payer.email as paid_by_email,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id', es.user_id,
            'amount', es.amount,
            'paid', es.paid,
            'user_name', p.full_name,
            'user_email', p.email,
            'user_avatar', p.avatar_url
          )
        )
        FROM expense_splits es
        INNER JOIN profiles p ON es.user_id = p.id
        WHERE es.expense_id = te.id
      ), '[]'::jsonb
    ) as splits
  FROM trip_expenses te
  LEFT JOIN categories c ON te.category_id = c.id
  LEFT JOIN profiles payer ON te.paid_by = payer.id
  WHERE te.trip_id = p_trip_id
  ORDER BY te.created_at DESC;
END;
$$; 