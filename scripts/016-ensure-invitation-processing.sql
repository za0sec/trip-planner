-- Este script se asegura de que las funciones para procesar invitaciones estén bien definidas
-- y que los triggers estén correctamente configurados. NO BORRA DATOS.

-- Función para procesar invitaciones pendientes cuando se crea un perfil
-- (Esta función ya existe en 015, pero la redefinimos para asegurar que es la última versión)
CREATE OR REPLACE FUNCTION process_pending_invitations_on_profile_creation()
RETURNS TRIGGER AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  RAISE NOTICE 'Trigger process_pending_invitations_on_profile_creation ejecutado para nuevo perfil ID: %, Email: %', NEW.id, NEW.email;

  -- Buscar invitaciones por email en trip_invitations
  FOR invitation_record IN
    SELECT ti.id as invitation_id, ti.trip_id, ti.role, ti.invited_by
    FROM trip_invitations ti
    WHERE ti.email = NEW.email
    AND ti.status = 'pending'
    AND ti.expires_at > NOW()
  LOOP
    RAISE NOTICE 'Procesando invitación por email ID: % para viaje ID: %', invitation_record.invitation_id, invitation_record.trip_id;
    -- Insertar en trip_members si no existe ya una invitación pendiente o aceptada para ese usuario y viaje
    INSERT INTO trip_members (trip_id, user_id, role, invited_by, status, joined_at)
    VALUES (invitation_record.trip_id, NEW.id, invitation_record.role, invitation_record.invited_by, 'accepted', NOW())
    ON CONFLICT (trip_id, user_id) DO NOTHING; -- Si ya existe, no hacer nada (podría ser una invitación directa ya procesada)

    -- Marcar la invitación por email como aceptada
    UPDATE trip_invitations
    SET status = 'accepted'
    WHERE id = invitation_record.invitation_id;
    RAISE NOTICE 'Invitación por email ID: % marcada como aceptada.', invitation_record.invitation_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER para que pueda modificar trip_members y trip_invitations

-- Trigger para procesar invitaciones automáticamente cuando se crea un perfil
DROP TRIGGER IF EXISTS trigger_process_pending_invitations_on_profile_creation ON profiles;
CREATE TRIGGER trigger_process_pending_invitations_on_profile_creation
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION process_pending_invitations_on_profile_creation();

-- Función para procesar invitaciones existentes para un usuario que ya tiene perfil
-- (Esta función ya existe en 015, la redefinimos para asegurar)
CREATE OR REPLACE FUNCTION process_existing_user_invitations(p_user_email TEXT, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  RAISE NOTICE 'Función process_existing_user_invitations ejecutada para Usuario ID: %, Email: %', p_user_id, p_user_email;

  -- Buscar invitaciones por email en trip_invitations
  FOR invitation_record IN
    SELECT ti.id as invitation_id, ti.trip_id, ti.role, ti.invited_by
    FROM trip_invitations ti
    WHERE ti.email = p_user_email
    AND ti.status = 'pending'
    AND ti.expires_at > NOW()
  LOOP
    RAISE NOTICE 'Procesando invitación por email ID: % para viaje ID: % (usuario existente)', invitation_record.invitation_id, invitation_record.trip_id;
    INSERT INTO trip_members (trip_id, user_id, role, invited_by, status, joined_at)
    VALUES (invitation_record.trip_id, p_user_id, invitation_record.role, invitation_record.invited_by, 'accepted', NOW())
    ON CONFLICT (trip_id, user_id) DO NOTHING;

    UPDATE trip_invitations
    SET status = 'accepted'
    WHERE id = invitation_record.invitation_id;
    RAISE NOTICE 'Invitación por email ID: % marcada como aceptada (usuario existente).', invitation_record.invitation_id;
  END LOOP;

  -- Adicionalmente, asegurar que si hay una entrada en trip_members con status 'pending' para este usuario,
  -- y no hay una invitación por email correspondiente (o ya fue procesada),
  -- esta se mantenga como 'pending' para que el usuario la vea en su dashboard.
  -- Esta parte es más para asegurar que las invitaciones directas a usuarios existentes se muestren.
  -- La lógica del dashboard ya busca en trip_members con status 'pending'.

  RAISE NOTICE 'Fin de process_existing_user_invitations para Usuario ID: %', p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: La función process_existing_user_invitations se llama desde AuthProvider.
-- La función process_pending_invitations_on_profile_creation se llama por trigger.
