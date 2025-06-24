-- Create trip_members table for collaboration
CREATE TABLE IF NOT EXISTS trip_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Create trip_invitations table for email invitations
CREATE TABLE IF NOT EXISTS trip_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  role TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  token UUID DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, email)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_trip_id ON trip_invitations(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_email ON trip_invitations(email);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_token ON trip_invitations(token);

-- Enable RLS
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trip_members
CREATE POLICY "Users can view trip members for their trips" ON trip_members FOR SELECT 
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid()
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "Trip owners can manage members" ON trip_members FOR ALL
  USING (
    trip_id IN (SELECT id FROM trips WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can update their own membership" ON trip_members FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for trip_invitations
CREATE POLICY "Users can view invitations for their trips" ON trip_invitations FOR SELECT 
  USING (
    trip_id IN (SELECT id FROM trips WHERE created_by = auth.uid())
  );

CREATE POLICY "Trip owners can manage invitations" ON trip_invitations FOR ALL
  USING (
    trip_id IN (SELECT id FROM trips WHERE created_by = auth.uid())
  );

-- Update trips RLS policies to include collaborators
DROP POLICY IF EXISTS "Users can view own trips" ON trips;
CREATE POLICY "Users can view own trips and shared trips" ON trips FOR SELECT 
  USING (
    created_by = auth.uid() OR
    id IN (
      SELECT trip_id FROM trip_members 
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );

-- Update activities RLS policies to include collaborators
DROP POLICY IF EXISTS "Users can view activities for their trips" ON activities;
CREATE POLICY "Users can view activities for accessible trips" ON activities FOR SELECT 
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid()
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Users can create activities for their trips" ON activities;
CREATE POLICY "Users can create activities for accessible trips" ON activities FOR INSERT 
  WITH CHECK (
    created_by = auth.uid() AND
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid()
      UNION
      SELECT trip_id FROM trip_members 
      WHERE user_id = auth.uid() AND status = 'accepted' AND role IN ('owner', 'editor')
    )
  );

-- Function to automatically add trip owner as member
CREATE OR REPLACE FUNCTION add_trip_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trip_members (trip_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.created_by, 'owner', 'accepted', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to add owner as member when trip is created
DROP TRIGGER IF EXISTS trigger_add_trip_owner_as_member ON trips;
CREATE TRIGGER trigger_add_trip_owner_as_member
  AFTER INSERT ON trips
  FOR EACH ROW
  EXECUTE FUNCTION add_trip_owner_as_member();
