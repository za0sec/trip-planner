-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trips table
CREATE TABLE IF NOT EXISTS trips (
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

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  date DATE NOT NULL,
  location TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activities table (renamed from itinerary_items)
CREATE TABLE IF NOT EXISTS activities (
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
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, icon, color) VALUES
  ('Vuelos', '✈️', '#EF4444'),
  ('Alojamiento', '🏨', '#8B5CF6'),
  ('Comida', '🍽️', '#F59E0B'),
  ('Transporte', '🚗', '#10B981'),
  ('Actividades', '🎭', '#EC4899'),
  ('Compras', '🛍️', '#6366F1'),
  ('Otros', '📝', '#6B7280')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for trips
CREATE POLICY "Users can view own trips" ON trips FOR SELECT USING (created_by = auth.uid());
CREATE POLICY "Users can create trips" ON trips FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own trips" ON trips FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Users can delete own trips" ON trips FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for expenses
CREATE POLICY "Users can view expenses for their trips" ON expenses FOR SELECT 
  USING (trip_id IN (SELECT id FROM trips WHERE created_by = auth.uid()));

CREATE POLICY "Users can create expenses for their trips" ON expenses FOR INSERT 
  WITH CHECK (
    created_by = auth.uid() AND
    trip_id IN (SELECT id FROM trips WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can update their own expenses" ON expenses FOR UPDATE 
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own expenses" ON expenses FOR DELETE 
  USING (created_by = auth.uid());

-- RLS Policies for activities
CREATE POLICY "Users can view activities for their trips" ON activities FOR SELECT 
  USING (trip_id IN (SELECT id FROM trips WHERE created_by = auth.uid()));

CREATE POLICY "Users can create activities for their trips" ON activities FOR INSERT 
  WITH CHECK (
    created_by = auth.uid() AND
    trip_id IN (SELECT id FROM trips WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can update their own activities" ON activities FOR UPDATE 
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own activities" ON activities FOR DELETE 
  USING (created_by = auth.uid());

-- Categories are public
CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_activities_trip_id ON activities(trip_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities(created_by);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
