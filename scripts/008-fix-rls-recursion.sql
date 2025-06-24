-- Fix RLS recursion issue and preserve existing data

-- First, let's fix the trips policies that are causing recursion
DROP POLICY IF EXISTS "Users can view own trips and shared trips" ON trips;

-- Create a simpler policy that doesn't cause recursion
CREATE POLICY "Users can view accessible trips" ON trips FOR SELECT 
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trip_members 
      WHERE trip_members.trip_id = trips.id 
      AND trip_members.user_id = auth.uid() 
      AND trip_members.status = 'accepted'
    )
  );

-- Fix activities policies to avoid recursion
DROP POLICY IF EXISTS "Users can view activities for accessible trips" ON activities;
DROP POLICY IF EXISTS "Users can create activities for accessible trips" ON activities;

CREATE POLICY "Users can view activities for accessible trips" ON activities FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = activities.trip_id 
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members 
          WHERE trip_members.trip_id = trips.id 
          AND trip_members.user_id = auth.uid() 
          AND trip_members.status = 'accepted'
        )
      )
    )
  );

CREATE POLICY "Users can create activities for accessible trips" ON activities FOR INSERT 
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = activities.trip_id 
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members 
          WHERE trip_members.trip_id = trips.id 
          AND trip_members.user_id = auth.uid() 
          AND trip_members.status = 'accepted'
          AND trip_members.role IN ('owner', 'editor')
        )
      )
    )
  );

-- Fix expenses policies too
DROP POLICY IF EXISTS "Users can view expenses for their trips" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses for their trips" ON expenses;

CREATE POLICY "Users can view expenses for accessible trips" ON expenses FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = expenses.trip_id 
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members 
          WHERE trip_members.trip_id = trips.id 
          AND trip_members.user_id = auth.uid() 
          AND trip_members.status = 'accepted'
        )
      )
    )
  );

CREATE POLICY "Users can create expenses for accessible trips" ON expenses FOR INSERT 
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = expenses.trip_id 
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members 
          WHERE trip_members.trip_id = trips.id 
          AND trip_members.user_id = auth.uid() 
          AND trip_members.status = 'accepted'
          AND trip_members.role IN ('owner', 'editor')
        )
      )
    )
  );

-- Ensure existing trip owners are added as members
-- This will only insert if they don't already exist
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
);

-- Create a view for easier querying of user accessible trips
CREATE OR REPLACE VIEW user_accessible_trips AS
SELECT DISTINCT
  t.*,
  COALESCE(tm.role, 'owner') as user_role,
  COALESCE(tm.status, 'accepted') as user_status
FROM trips t
LEFT JOIN trip_members tm ON t.id = tm.trip_id AND tm.user_id = auth.uid()
WHERE 
  t.created_by = auth.uid() OR 
  (tm.user_id = auth.uid() AND tm.status = 'accepted');
