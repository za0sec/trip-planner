-- Add AI recommendations functionality
-- Create trip_locations table to store location per day
CREATE TABLE IF NOT EXISTS trip_locations (
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
CREATE TABLE IF NOT EXISTS ai_recommendations (
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

-- Enable RLS
ALTER TABLE trip_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trip_locations
CREATE POLICY "Users can view locations for their trips" ON trip_locations FOR SELECT 
  USING (
    trip_id IN (
      SELECT id FROM trips 
      WHERE created_by = auth.uid() 
      OR id IN (
        SELECT trip_id FROM trip_members 
        WHERE user_id = auth.uid() AND status = 'accepted'
      )
    )
  );

CREATE POLICY "Users can create locations for their trips" ON trip_locations FOR INSERT 
  WITH CHECK (
    created_by = auth.uid() AND
    trip_id IN (
      SELECT id FROM trips 
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT trip_id FROM trip_members 
        WHERE user_id = auth.uid() AND status = 'accepted' AND role IN ('editor', 'admin')
      )
    )
  );

CREATE POLICY "Users can update locations for their trips" ON trip_locations FOR UPDATE 
  USING (
    trip_id IN (
      SELECT id FROM trips 
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT trip_id FROM trip_members 
        WHERE user_id = auth.uid() AND status = 'accepted' AND role IN ('editor', 'admin')
      )
    )
  );

CREATE POLICY "Users can delete locations for their trips" ON trip_locations FOR DELETE 
  USING (
    trip_id IN (
      SELECT id FROM trips 
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT trip_id FROM trip_members 
        WHERE user_id = auth.uid() AND status = 'accepted' AND role IN ('editor', 'admin')
      )
    )
  );

-- RLS Policies for ai_recommendations  
CREATE POLICY "Users can view recommendations for their trip locations" ON ai_recommendations FOR SELECT 
  USING (
    trip_location_id IN (
      SELECT tl.id FROM trip_locations tl
      JOIN trips t ON tl.trip_id = t.id
      WHERE t.created_by = auth.uid()
      OR t.id IN (
        SELECT trip_id FROM trip_members 
        WHERE user_id = auth.uid() AND status = 'accepted'
      )
    )
  );

-- Only the system can insert/update/delete AI recommendations (they're generated)
CREATE POLICY "System can manage ai_recommendations" ON ai_recommendations FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trip_locations_trip_id ON trip_locations(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_locations_date ON trip_locations(date);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_trip_location_id ON ai_recommendations(trip_location_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_category ON ai_recommendations(category); 