-- SOLUCIÓN DRÁSTICA: Deshabilitar RLS completamente y usar verificaciones en el código

-- Deshabilitar RLS en todas las tablas
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invitations DISABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "trips_owner_only" ON trips;
DROP POLICY IF EXISTS "activities_owner_only" ON activities;
DROP POLICY IF EXISTS "expenses_owner_only" ON expenses;
DROP POLICY IF EXISTS "trip_members_own_only" ON trip_members;
DROP POLICY IF EXISTS "trip_invitations_read" ON trip_invitations;
DROP POLICY IF EXISTS "trip_invitations_write" ON trip_invitations;
DROP POLICY IF EXISTS "trip_invitations_update" ON trip_invitations;
DROP POLICY IF EXISTS "trip_invitations_delete" ON trip_invitations;

-- Mantener solo RLS en profiles (que funciona bien)
-- Las políticas de profiles ya funcionan correctamente

-- Crear funciones de seguridad para verificar acceso en el código
CREATE OR REPLACE FUNCTION verify_trip_access(trip_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar si el usuario es propietario o miembro
  RETURN EXISTS (
    SELECT 1 FROM trips WHERE id = trip_uuid AND created_by = user_uuid
    UNION
    SELECT 1 FROM trip_members 
    WHERE trip_id = trip_uuid AND user_id = user_uuid AND status = 'accepted'
  );
END;
$$;

CREATE OR REPLACE FUNCTION verify_trip_edit_access(trip_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar si el usuario puede editar (propietario o editor)
  RETURN EXISTS (
    SELECT 1 FROM trips WHERE id = trip_uuid AND created_by = user_uuid
    UNION
    SELECT 1 FROM trip_members 
    WHERE trip_id = trip_uuid AND user_id = user_uuid AND status = 'accepted' AND role IN ('owner', 'editor')
  );
END;
$$;

-- Asegurar que los propietarios estén en trip_members
INSERT INTO trip_members (trip_id, user_id, role, status, joined_at)
SELECT 
  t.id,
  t.created_by,
  'owner',
  'accepted',
  t.created_at
FROM trips t
WHERE NOT EXISTS (
  SELECT 1 FROM trip_members tm 
  WHERE tm.trip_id = t.id AND tm.user_id = t.created_by
)
ON CONFLICT (trip_id, user_id) DO NOTHING;
