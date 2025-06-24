-- Temporarily disable RLS to check if that's the issue
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Re-enable with simpler policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create simpler, more permissive policies for profiles
CREATE POLICY "Enable all operations for authenticated users" ON profiles
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Check trips policies too
DROP POLICY IF EXISTS "Users can view own trips" ON trips;
DROP POLICY IF EXISTS "Users can create trips" ON trips;
DROP POLICY IF EXISTS "Users can update own trips" ON trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON trips;

-- Simpler trips policies
CREATE POLICY "Enable read access for own trips" ON trips
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Enable insert for authenticated users" ON trips
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Enable update for own trips" ON trips
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Enable delete for own trips" ON trips
  FOR DELETE USING (auth.uid() = created_by);
