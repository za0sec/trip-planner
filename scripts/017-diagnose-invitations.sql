-- SCRIPT DE DIAGNÓSTICO (NO MODIFICA NADA)
-- Este script te ayudará a entender el estado de las invitaciones para un email específico.
-- Reemplaza 'email.del.invitado@ejemplo.com' con el email que estás intentando invitar.

DO $$
DECLARE
    v_user_email TEXT := 'email.del.invitado@ejemplo.com'; -- <<-- REEMPLAZA ESTE EMAIL
    v_user_id UUID;
    v_profile_found BOOLEAN := FALSE;
    v_trip_member RECORD;
    v_trip_invitation RECORD;
BEGIN
    RAISE NOTICE '--- DIAGNÓSTICO DE INVITACIONES PARA: % ---', v_user_email;

    -- 1. Buscar el perfil del usuario
    SELECT id INTO v_user_id FROM profiles WHERE email = v_user_email;

    IF v_user_id IS NOT NULL THEN
        v_profile_found := TRUE;
        RAISE NOTICE '✅ Perfil encontrado. User ID: %', v_user_id;
    ELSE
        RAISE NOTICE '⚠️ Perfil no encontrado para este email.';
    END IF;

    -- 2. Buscar en la tabla trip_members (invitaciones directas a usuarios existentes)
    RAISE NOTICE '---';
    RAISE NOTICE '🔍 Buscando en "trip_members"...';
    IF v_profile_found THEN
        FOR v_trip_member IN
            SELECT tm.trip_id, t.title, tm.status, tm.role, tm.created_at
            FROM trip_members tm
            JOIN trips t ON tm.trip_id = t.id
            WHERE tm.user_id = v_user_id
        LOOP
            RAISE NOTICE '  - Viaje: "%" (ID: %), Estado: %, Rol: %, Creado: %',
                         v_trip_member.title, v_trip_member.trip_id, v_trip_member.status, v_trip_member.role, v_trip_member.created_at;
        END LOOP;
    ELSE
        RAISE NOTICE '  (Saltado, el perfil no existe)';
    END IF;


    -- 3. Buscar en la tabla trip_invitations (invitaciones por email a usuarios no existentes)
    RAISE NOTICE '---';
    RAISE NOTICE '🔍 Buscando en "trip_invitations"...';
    FOR v_trip_invitation IN
        SELECT ti.trip_id, t.title, ti.status, ti.role, ti.created_at, ti.expires_at
        FROM trip_invitations ti
        JOIN trips t ON ti.trip_id = t.id
        WHERE ti.email = v_user_email
    LOOP
        RAISE NOTICE '  - Viaje: "%" (ID: %), Estado: %, Rol: %, Creado: %, Expira: %',
                     v_trip_invitation.title, v_trip_invitation.trip_id, v_trip_invitation.status, v_trip_invitation.role, v_trip_invitation.created_at, v_trip_invitation.expires_at;
    END LOOP;

    RAISE NOTICE '--- FIN DEL DIAGNÓSTICO ---';
END $$;
