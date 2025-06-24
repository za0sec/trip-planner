-- Agregar tabla de gastos generales (sin fechas específicas)
-- NO borramos datos existentes, solo agregamos funcionalidad

-- Crear tabla de gastos generales
CREATE TABLE IF NOT EXISTS trip_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  purchase_date DATE,
  location TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'purchased', 'refunded')),
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar nuevas categorías específicas para gastos generales
INSERT INTO categories (name, icon, color) VALUES
  ('Entradas', '🎫', '#FF6B6B'),
  ('Seguros', '🛡️', '#4ECDC4'),
  ('Visas', '📄', '#45B7D1'),
  ('Equipaje', '🧳', '#96CEB4'),
  ('Internet/SIM', '📱', '#FFEAA7'),
  ('Propinas', '💰', '#DDA0DD')
ON CONFLICT (name) DO NOTHING;

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip_id ON trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_created_by ON trip_expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_category_id ON trip_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_status ON trip_expenses(status);

-- No habilitamos RLS ya que lo deshabilitamos en el script anterior
-- La seguridad se maneja en el código

-- Función para obtener gastos de un viaje (sin RLS)
CREATE OR REPLACE FUNCTION get_trip_expenses(trip_uuid UUID, user_uuid UUID)
RETURNS TABLE (
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
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  category_name TEXT,
  category_icon TEXT,
  category_color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar si el usuario tiene acceso al viaje
  IF NOT EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_uuid AND t.created_by = user_uuid
    UNION
    SELECT 1 FROM trip_members tm WHERE tm.trip_id = trip_uuid AND tm.user_id = user_uuid AND tm.status = 'accepted'
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
    te.created_by,
    te.created_at,
    c.name as category_name,
    c.icon as category_icon,
    c.color as category_color
  FROM trip_expenses te
  LEFT JOIN categories c ON te.category_id = c.id
  WHERE te.trip_id = trip_uuid
  ORDER BY te.created_at DESC;
END;
$$;

-- Función para verificar si el usuario puede agregar gastos al viaje
CREATE OR REPLACE FUNCTION user_can_add_expense(trip_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trips WHERE id = trip_uuid AND created_by = user_uuid
    UNION
    SELECT 1 FROM trip_members 
    WHERE trip_id = trip_uuid AND user_id = user_uuid AND status = 'accepted' AND role IN ('owner', 'editor')
  );
END;
$$;
