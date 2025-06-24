-- Function to get trip members with their profile information
-- This function bypasses RLS on trip_members and profiles for users who have access to the trip.

CREATE OR REPLACE FUNCTION get_trip_members_with_profiles(p_trip_id UUID)
RETURNS TABLE (
  member_id UUID,
  trip_id UUID,
  user_id UUID,
  role TEXT,
  status TEXT,
  joined_at TIMESTAMP WITH TIME ZONE,
  profile_full_name TEXT,
  profile_avatar_url TEXT,
  profile_email TEXT -- Added email for display purposes
)
LANGUAGE plpgsql
SECURITY DEFINER
-- SET search_path = public; -- Asegura que las tablas se encuentren sin prefijo.
-- Comentado porque a veces causa problemas si el search_path del usuario es diferente.
-- Las tablas deben estar en el esquema 'public' o referenciarse con 'public.tabla'.
AS $$
BEGIN
  -- First, verify if the calling user has access to the trip.
  -- This uses the existing user_can_access_trip function.
  IF NOT public.user_can_access_trip(p_trip_id, auth.uid()) THEN
    -- If user_can_access_trip returns false, return an empty set.
    -- Alternatively, you could raise an exception:
    -- RAISE EXCEPTION 'Access denied to trip %', p_trip_id;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    tm.id as member_id,
    tm.trip_id,
    tm.user_id,
    tm.role,
    tm.status,
    tm.joined_at,
    p.full_name as profile_full_name,
    p.avatar_url as profile_avatar_url,
    p.email as profile_email
  FROM
    public.trip_members tm
  JOIN
    public.profiles p ON tm.user_id = p.id
  WHERE
    tm.trip_id = p_trip_id;
END;
$$;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION public.get_trip_members_with_profiles(UUID) TO authenticated;
