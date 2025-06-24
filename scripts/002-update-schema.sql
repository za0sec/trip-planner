-- Update itinerary_items table to support more activity types
ALTER TABLE itinerary_items 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'activity',
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'booked', 'completed'));

-- Update expenses table to link with activities
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES itinerary_items(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_activity_id ON expenses(activity_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_category ON itinerary_items(category);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

-- Update categories with more travel-specific options
INSERT INTO categories (name, icon, color) VALUES
  ('Vuelos', '✈️', '#EF4444'),
  ('Alojamiento', '🏨', '#8B5CF6'),
  ('Comida', '🍽️', '#F59E0B'),
  ('Transporte', '🚗', '#10B981'),
  ('Actividades', '🎭', '#EC4899'),
  ('Compras', '🛍️', '#6366F1'),
  ('Otros', '📝', '#6B7280')
ON CONFLICT (name) DO UPDATE SET
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;
