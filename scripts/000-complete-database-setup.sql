-- ============================================================================
-- TRIP PLANNER - COMPLETE DATABASE SETUP SCRIPT
-- ============================================================================
-- This script creates the entire database schema from scratch
-- Run this script in your Supabase SQL editor to set up the complete database

-- ============================================================================
-- 1. CLEANUP - Drop existing tables and functions if they exist
-- ============================================================================

-- Drop functions first
DROP FUNCTION IF EXISTS get_trip_expenses(UUID, UUID);
DROP FUNCTION IF EXISTS get_trip_members_with_profiles(UUID);
DROP FUNCTION IF EXISTS user_can_access_trip(UUID, UUID);
DROP FUNCTION IF EXISTS user_can_add_expense(UUID, UUID);
DROP FUNCTION IF EXISTS verify_trip_access(UUID, UUID);
DROP FUNCTION IF EXISTS add_trip_owner_as_member();
DROP FUNCTION IF EXISTS process_pending_invitations();
DROP FUNCTION IF EXISTS process_existing_invitations(TEXT, UUID);

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_add_trip_owner_as_member ON trips;
DROP TRIGGER IF EXISTS trigger_process_pending_invitations ON profiles;

-- Drop tables in correct order (reverse dependency order)
DROP TABLE IF EXISTS ai_recommendations CASCADE;
DROP TABLE IF EXISTS trip_locations CASCADE;
DROP TABLE IF EXISTS trip_expenses CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS trip_invitations CASCADE;
DROP TABLE IF EXISTS trip_members CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================================
-- 2. CREATE STORAGE BUCKETS
-- ============================================================================

-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('trip-items', 'trip-items', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. CREATE CORE TABLES
-- ============================================================================

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trips table
CREATE TABLE trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  destination TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  budget DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activities table
CREATE TABLE activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'activity',
  location TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'booked', 'completed')),
  image_url TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expenses table (for date-specific expenses)
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  date DATE NOT NULL,
  location TEXT,
  image_url TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trip_expenses table (for general trip expenses without specific dates)
CREATE TABLE trip_expenses (
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
  image_url TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. CREATE COLLABORATION TABLES
-- ============================================================================

-- Create trip_members table for collaboration
CREATE TABLE trip_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Create trip_invitations table for email invitations
CREATE TABLE trip_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  role TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  token UUID DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, email)
);

-- ============================================================================
-- 5. CREATE AI RECOMMENDATIONS TABLES
-- ============================================================================

-- Create trip_locations table to store location per day
CREATE TABLE trip_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  location TEXT NOT NULL,
  city TEXT,
  country TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, date)
);

-- Create ai_recommendations table to store generated recommendations
CREATE TABLE ai_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_location_id UUID REFERENCES trip_locations(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'restaurants', 'attractions', 'activities', 'museums', 'nightlife', 'shopping'
  title TEXT NOT NULL,
  description TEXT,
  address TEXT,
  rating DECIMAL(2,1),
  price_level INTEGER, -- 1-4 scale
  opening_hours TEXT,
  website TEXT,
  phone TEXT,
  recommendation_reason TEXT,
  ai_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. INSERT DEFAULT DATA
-- ============================================================================

-- Insert default categories
INSERT INTO categories (name, icon, color) VALUES
  ('Vuelos', '✈️', '#EF4444'),
  ('Alojamiento', '🏨', '#8B5CF6'),
  ('Comida', '🍽️', '#F59E0B'),
  ('Transporte', '🚗', '#10B981'),
  ('Actividades', '🎭', '#EC4899'),
  ('Compras', '🛍️', '#6366F1'),
  ('Entradas', '🎫', '#FF6B6B'),
  ('Seguros', '🛡️', '#4ECDC4'),
  ('Visas', '📄', '#45B7D1'),
  ('Equipaje', '🧳', '#96CEB4'),
  ('Internet/SIM', '📱', '#FFEAA7'),
  ('Propinas', '💰', '#DDA0DD'),
  ('Otros', '📝', '#6B7280');

-- ============================================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core table indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_trips_created_by ON trips(created_by);
CREATE INDEX idx_trips_start_date ON trips(start_date);

-- Activities indexes
CREATE INDEX idx_activities_trip_id ON activities(trip_id);
CREATE INDEX idx_activities_created_by ON activities(created_by);
CREATE INDEX idx_activities_date ON activities(date);
CREATE INDEX idx_activities_status ON activities(status);

-- Expenses indexes
CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);
CREATE INDEX idx_expenses_activity_id ON expenses(activity_id);
CREATE INDEX idx_expenses_date ON expenses(date);

-- Trip expenses indexes
CREATE INDEX idx_trip_expenses_trip_id ON trip_expenses(trip_id);
CREATE INDEX idx_trip_expenses_created_by ON trip_expenses(created_by);
CREATE INDEX idx_trip_expenses_category_id ON trip_expenses(category_id);
CREATE INDEX idx_trip_expenses_status ON trip_expenses(status);

-- Collaboration indexes
CREATE INDEX idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX idx_trip_members_status ON trip_members(status);
CREATE INDEX idx_trip_invitations_trip_id ON trip_invitations(trip_id);
CREATE INDEX idx_trip_invitations_email ON trip_invitations(email);
CREATE INDEX idx_trip_invitations_token ON trip_invitations(token);
CREATE INDEX idx_trip_invitations_status ON trip_invitations(status);

-- AI recommendations indexes
CREATE INDEX idx_trip_locations_trip_id ON trip_locations(trip_id);
CREATE INDEX idx_trip_locations_date ON trip_locations(date);
CREATE INDEX idx_ai_recommendations_trip_location_id ON ai_recommendations(trip_location_id);
CREATE INDEX idx_ai_recommendations_category ON ai_recommendations(category);

-- ============================================================================
-- 8. CREATE UTILITY FUNCTIONS
-- ============================================================================

-- Function to verify if user can access a trip
CREATE OR REPLACE FUNCTION verify_trip_access(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trips WHERE id = p_trip_id AND created_by = p_user_id
    UNION
    SELECT 1 FROM trip_members 
    WHERE trip_id = p_trip_id AND user_id = p_user_id AND status = 'accepted'
  );
END;
$$;

-- Function to check if user can access a trip (alias for compatibility)
CREATE OR REPLACE FUNCTION user_can_access_trip(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN verify_trip_access(p_trip_id, p_user_id);
END;
$$;

-- Function to check if user can add expenses to a trip
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

-- Function to get trip expenses with category information
CREATE OR REPLACE FUNCTION get_trip_expenses(p_trip_id UUID, p_user_id UUID)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    category_id UUID,
    title TEXT,
    description TEXT,
    amount NUMERIC,
    currency TEXT,
    purchase_date DATE,
    location TEXT,
    status TEXT,
    receipt_url TEXT,
    notes TEXT,
    image_url TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ,
    category_name TEXT,
    category_icon TEXT,
    category_color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user has access to the trip
  IF NOT verify_trip_access(p_trip_id, p_user_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.trip_id,
    e.category_id,
    e.title,
    e.description,
    e.amount,
    e.currency,
    e.purchase_date,
    e.location,
    e.status,
    e.receipt_url,
    e.notes,
    e.image_url,
    e.created_by,
    e.created_at,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color
  FROM
    trip_expenses e
  LEFT JOIN
    categories c ON e.category_id = c.id
  WHERE
    e.trip_id = p_trip_id
  ORDER BY e.created_at DESC;
END;
$$;

-- Function to get trip members with their profile information
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
  profile_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify if the calling user has access to the trip
  IF NOT user_can_access_trip(p_trip_id, auth.uid()) THEN
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
    trip_members tm
  JOIN
    profiles p ON tm.user_id = p.id
  WHERE
    tm.trip_id = p_trip_id;
END;
$$;

-- Function to automatically add trip owner as member
CREATE OR REPLACE FUNCTION add_trip_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trip_members (trip_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.created_by, 'owner', 'accepted', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to process pending invitations when a profile is created
CREATE OR REPLACE FUNCTION process_pending_invitations()
RETURNS TRIGGER AS $$
BEGIN
  -- Add user to trip_members if there are pending invitations
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

  -- Mark invitations as accepted
  UPDATE trip_invitations 
  SET status = 'accepted'
  WHERE email = NEW.email 
  AND status = 'pending'
  AND expires_at > NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to process existing invitations for users who already exist
CREATE OR REPLACE FUNCTION process_existing_invitations(user_email TEXT, user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Add to trip_members if there are pending invitations
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

  -- Mark invitations as accepted
  UPDATE trip_invitations 
  SET status = 'accepted'
  WHERE email = user_email 
  AND status = 'pending'
  AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. CREATE TRIGGERS
-- ============================================================================

-- Trigger to add owner as member when trip is created
CREATE TRIGGER trigger_add_trip_owner_as_member
  AFTER INSERT ON trips
  FOR EACH ROW
  EXECUTE FUNCTION add_trip_owner_as_member();

-- Trigger to process pending invitations when profile is created
CREATE TRIGGER trigger_process_pending_invitations
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION process_pending_invitations();

-- ============================================================================
-- 10. DISABLE RLS (Row Level Security)
-- ============================================================================
-- Note: RLS is disabled for simplicity. Access control is handled in application code.

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. SETUP STORAGE POLICIES
-- ============================================================================

-- Storage policies for avatars bucket
CREATE POLICY "Public Avatars Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "User Can Upload Own Avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = regexp_replace(name, '\.[^.]+$', '')
);

CREATE POLICY "User Can Update Own Avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = regexp_replace(name, '\.[^.]+$', '')
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = regexp_replace(name, '\.[^.]+$', '')
);

CREATE POLICY "User Can Delete Own Avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = regexp_replace(name, '\.[^.]+$', '')
);

-- Storage policies for trip-items bucket
CREATE POLICY "Public Trip Items Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'trip-items' );

CREATE POLICY "Authenticated Users Can Upload Trip Items"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'trip-items' );

CREATE POLICY "Users Can Update Own Trip Items"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trip-items' AND
  auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'trip-items' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users Can Delete Own Trip Items"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trip-items' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- ============================================================================
-- 12. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION verify_trip_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_access_trip(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_add_expense(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_expenses(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_members_with_profiles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_existing_invitations(TEXT, UUID) TO authenticated;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

-- Create a view to check if setup was successful
CREATE OR REPLACE VIEW setup_verification AS
SELECT 
  'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'trips', COUNT(*) FROM trips
UNION ALL
SELECT 'activities', COUNT(*) FROM activities
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL
SELECT 'trip_expenses', COUNT(*) FROM trip_expenses
UNION ALL
SELECT 'trip_members', COUNT(*) FROM trip_members
UNION ALL
SELECT 'trip_invitations', COUNT(*) FROM trip_invitations
UNION ALL
SELECT 'trip_locations', COUNT(*) FROM trip_locations
UNION ALL
SELECT 'ai_recommendations', COUNT(*) FROM ai_recommendations;

-- Display setup completion message
DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'TRIP PLANNER DATABASE SETUP COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Tables created: 10';
  RAISE NOTICE 'Functions created: 7 (including process_existing_invitations)';
  RAISE NOTICE 'Triggers created: 2';
  RAISE NOTICE 'Storage buckets configured: 2 (avatars, trip-items)';
  RAISE NOTICE 'Default categories inserted: 13';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'You can now start using your Trip Planner application!';
  RAISE NOTICE 'Run: SELECT * FROM setup_verification; to verify all tables are created.';
  RAISE NOTICE '============================================================================';
END $$; 