-- ULTIMATE RLS FIX: Remove all complex policies and use ultra-simple approach

-- Disable RLS temporarily to clean up
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invitations DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies completely
DROP POLICY IF EXISTS "trips_select_policy" ON trips;
DROP POLICY IF EXISTS "trips_insert_policy" ON trips;
DROP POLICY IF EXISTS "trips_update_policy" ON trips;
DROP POLICY IF EXISTS "trips_delete_policy" ON trips;

DROP POLICY IF EXISTS "activities_select_policy" ON activities;
DROP POLICY IF EXISTS "activities_insert_policy" ON activities;
DROP POLICY IF EXISTS "activities_update_policy" ON activities;
DROP POLICY IF EXISTS "activities_delete_policy" ON activities;

DROP POLICY IF EXISTS "expenses_select_policy" ON expenses;
DROP POLICY IF EXISTS "expenses_insert_policy" ON expenses;
DROP POLICY IF EXISTS "expenses_update_policy" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_policy" ON expenses;

DROP POLICY IF EXISTS "trip_members_select_policy" ON trip_members;
DROP POLICY IF EXISTS "trip_members_insert_policy" ON trip_members;
DROP POLICY IF EXISTS "trip_members_update_policy" ON trip_members;
DROP POLICY IF EXISTS "trip_members_delete_policy" ON trip_members;

DROP POLICY IF EXISTS "trip_invitations_select_policy" ON trip_invitations;
DROP POLICY IF EXISTS "trip_invitations_insert_policy" ON trip_invitations;
DROP POLICY IF EXISTS "trip_invitations_update_policy" ON trip_invitations;
DROP POLICY IF EXISTS "trip_invitations_delete_policy" ON trip_invitations;

-- Re-enable RLS
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invitations ENABLE ROW LEVEL SECURITY;

-- Create ULTRA-SIMPLE policies that only check direct ownership
-- NO SUBQUERIES, NO JOINS, NO RECURSION

-- TRIPS: Only direct ownership
CREATE POLICY "trips_owner_only" ON trips FOR ALL 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ACTIVITIES: Only direct ownership
CREATE POLICY "activities_owner_only" ON activities FOR ALL 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- EXPENSES: Only direct ownership  
CREATE POLICY "expenses_owner_only" ON expenses FOR ALL 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- TRIP_MEMBERS: Only own membership records
CREATE POLICY "trip_members_own_only" ON trip_members FOR ALL 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- TRIP_INVITATIONS: Public read for tokens, owner write
CREATE POLICY "trip_invitations_read" ON trip_invitations FOR SELECT 
  USING (true);

CREATE POLICY "trip_invitations_write" ON trip_invitations FOR INSERT 
  WITH CHECK (invited_by = auth.uid());

CREATE POLICY "trip_invitations_update" ON trip_invitations FOR UPDATE 
  USING (invited_by = auth.uid());

CREATE POLICY "trip_invitations_delete" ON trip_invitations FOR DELETE 
  USING (invited_by = auth.uid());

-- Create RPC functions to handle shared access (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_trips(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  budget DECIMAL(10,2),
  currency TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  user_role TEXT,
  user_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Owned trips
  SELECT 
    t.id,
    t.title,
    t.description,
    t.destination,
    t.start_date,
    t.end_date,
    t.budget,
    t.currency,
    t.created_by,
    t.created_at,
    'owner'::TEXT as user_role,
    'accepted'::TEXT as user_status
  FROM trips t
  WHERE t.created_by = user_uuid
  
  UNION ALL
  
  -- Shared trips
  SELECT 
    t.id,
    t.title,
    t.description,
    t.destination,
    t.start_date,
    t.end_date,
    t.budget,
    t.currency,
    t.created_by,
    t.created_at,
    tm.role as user_role,
    tm.status as user_status
  FROM trips t
  JOIN trip_members tm ON t.id = tm.trip_id
  WHERE tm.user_id = user_uuid AND tm.status = 'accepted';
END;
$$;

-- Function to get trip activities (bypasses RLS)
CREATE OR REPLACE FUNCTION get_trip_activities(trip_uuid UUID, user_uuid UUID)
RETURNS TABLE (
  id UUID,
  trip_id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  location TEXT,
  date DATE,
  start_time TIME,
  end_time TIME,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  status TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has access to this trip
  IF NOT EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_uuid AND t.created_by = user_uuid
    UNION
    SELECT 1 FROM trip_members tm WHERE tm.trip_id = trip_uuid AND tm.user_id = user_uuid AND tm.status = 'accepted'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.trip_id,
    a.title,
    a.description,
    a.category,
    a.location,
    a.date,
    a.start_time,
    a.end_time,
    a.estimated_cost,
    a.actual_cost,
    a.status,
    a.created_by,
    a.created_at
  FROM activities a
  WHERE a.trip_id = trip_uuid
  ORDER BY a.date ASC NULLS LAST, a.start_time ASC NULLS LAST;
END;
$$;

-- Function to check trip access
CREATE OR REPLACE FUNCTION user_can_access_trip(trip_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_uuid AND t.created_by = user_uuid
    UNION
    SELECT 1 FROM trip_members tm WHERE tm.trip_id = trip_uuid AND tm.user_id = user_uuid AND tm.status = 'accepted'
  );
END;
$$;

-- Function to check if user can edit trip
CREATE OR REPLACE FUNCTION user_can_edit_trip(trip_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_uuid AND t.created_by = user_uuid
    UNION
    SELECT 1 FROM trip_members tm 
    WHERE tm.trip_id = trip_uuid 
    AND tm.user_id = user_uuid 
    AND tm.status = 'accepted' 
    AND tm.role IN ('owner', 'editor')
  );
END;
$$;

-- Ensure trip owners are in trip_members
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
