-- Arreglar las invitaciones automáticas
-- Cuando alguien se registra con un email que tiene invitación pendiente, debe unirse automáticamente

-- Función para procesar invitaciones automáticas cuando se crea un perfil
CREATE OR REPLACE FUNCTION process_pending_invitations()
RETURNS TRIGGER AS $$
BEGIN
  -- Buscar invitaciones pendientes para este email
  INSERT INTO trip_members (trip_id, user_id, role, invited_by, status, joined_at)
  SELECT 
    ti.trip_id,
    NEW.id,
    ti.role,
    ti.invited_by,
    'accepted',
    NOW()
  FROM trip_invitations ti
  WHERE ti.email = NEW.email 
  AND ti.status = 'pending'
  AND ti.expires_at > NOW()
  ON CONFLICT (trip_id, user_id) DO NOTHING;

  -- Marcar las invitaciones como aceptadas
  UPDATE trip_invitations 
  SET status = 'accepted'
  WHERE email = NEW.email 
  AND status = 'pending'
  AND expires_at > NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para procesar invitaciones automáticamente
DROP TRIGGER IF EXISTS trigger_process_pending_invitations ON profiles;
CREATE TRIGGER trigger_process_pending_invitations
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION process_pending_invitations();

-- También procesar invitaciones existentes para usuarios que ya existen
CREATE OR REPLACE FUNCTION process_existing_invitations(user_email TEXT, user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Agregar a trip_members si hay invitaciones pendientes
  INSERT INTO trip_members (trip_id, user_id, role, invited_by, status, joined_at)
  SELECT 
    ti.trip_id,
    user_id,
    ti.role,
    ti.invited_by,
    'accepted',
    NOW()
  FROM trip_invitations ti
  WHERE ti.email = user_email 
  AND ti.status = 'pending'
  AND ti.expires_at > NOW()
  ON CONFLICT (trip_id, user_id) DO NOTHING;

  -- Marcar invitaciones como aceptadas
  UPDATE trip_invitations 
  SET status = 'accepted'
  WHERE email = user_email 
  AND status = 'pending'
  AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql;
