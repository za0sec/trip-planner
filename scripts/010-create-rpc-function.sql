-- Create RPC function to get shared trips (bypasses RLS)
CREATE OR REPLACE FUNCTION get_shared_trips(trip_ids UUID[])
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
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
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
    t.created_at
  FROM trips t
  WHERE t.id = ANY(trip_ids);
END;
$$;
