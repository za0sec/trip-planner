-- Completely disable and recreate RLS policies to fix recursion

-- Disable RLS temporarily
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invitations DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view accessible trips" ON trips;
DROP POLICY IF EXISTS "Users can create trips" ON trips;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON trips;
DROP POLICY IF EXISTS "Enable read access for own trips" ON trips;
DROP POLICY IF EXISTS "Enable update for own trips" ON trips;
DROP POLICY IF EXISTS "Enable delete for own trips" ON trips;

DROP POLICY IF EXISTS "Users can view activities for accessible trips" ON activities;
DROP POLICY IF EXISTS "Users can create activities for accessible trips" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;

DROP POLICY IF EXISTS "Users can view expenses for accessible trips" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses for accessible trips" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON expenses;

DROP POLICY IF EXISTS "Users can view trip members for their trips" ON trip_members;
DROP POLICY IF EXISTS "Trip owners can manage members" ON trip_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON trip_members;

DROP POLICY IF EXISTS "Users can view invitations for their trips" ON trip_invitations;
DROP POLICY IF EXISTS "Trip owners can manage invitations" ON trip_invitations;

-- Re-enable RLS
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invitations ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies for trips
CREATE POLICY "trips_select_policy" ON trips FOR SELECT 
  USING (created_by = auth.uid());

CREATE POLICY "trips_insert_policy" ON trips FOR INSERT 
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "trips_update_policy" ON trips FOR UPDATE 
  USING (created_by = auth.uid());

CREATE POLICY "trips_delete_policy" ON trips FOR DELETE 
  USING (created_by = auth.uid());

-- Simple policies for activities
CREATE POLICY "activities_select_policy" ON activities FOR SELECT 
  USING (created_by = auth.uid());

CREATE POLICY "activities_insert_policy" ON activities FOR INSERT 
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "activities_update_policy" ON activities FOR UPDATE 
  USING (created_by = auth.uid());

CREATE POLICY "activities_delete_policy" ON activities FOR DELETE 
  USING (created_by = auth.uid());

-- Simple policies for expenses
CREATE POLICY "expenses_select_policy" ON expenses FOR SELECT 
  USING (created_by = auth.uid());

CREATE POLICY "expenses_insert_policy" ON expenses FOR INSERT 
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "expenses_update_policy" ON expenses FOR UPDATE 
  USING (created_by = auth.uid());

CREATE POLICY "expenses_delete_policy" ON expenses FOR DELETE 
  USING (created_by = auth.uid());

-- Simple policies for trip_members
CREATE POLICY "trip_members_select_policy" ON trip_members FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "trip_members_insert_policy" ON trip_members FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "trip_members_update_policy" ON trip_members FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "trip_members_delete_policy" ON trip_members FOR DELETE 
  USING (user_id = auth.uid());

-- Simple policies for trip_invitations
CREATE POLICY "trip_invitations_select_policy" ON trip_invitations FOR SELECT 
  USING (true); -- Public read for invitation tokens

CREATE POLICY "trip_invitations_insert_policy" ON trip_invitations FOR INSERT 
  WITH CHECK (invited_by = auth.uid());

CREATE POLICY "trip_invitations_update_policy" ON trip_invitations FOR UPDATE 
  USING (invited_by = auth.uid());

CREATE POLICY "trip_invitations_delete_policy" ON trip_invitations FOR DELETE 
  USING (invited_by = auth.uid());

-- Ensure existing trip owners are added as members
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
