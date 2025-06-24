-- Expand tutorial system to handle multiple tutorial types
-- First, rename the existing column to be more specific
ALTER TABLE profiles 
RENAME COLUMN tutorial_completed TO dashboard_tutorial_completed;

-- Add columns for different tutorial types
ALTER TABLE profiles 
ADD COLUMN create_trip_tutorial_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN trip_management_tutorial_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN ai_tutorial_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN collaboration_tutorial_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to have all tutorials as not completed
UPDATE profiles 
SET 
  create_trip_tutorial_completed = FALSE,
  trip_management_tutorial_completed = FALSE,
  ai_tutorial_completed = FALSE,
  collaboration_tutorial_completed = FALSE
WHERE 
  create_trip_tutorial_completed IS NULL 
  OR trip_management_tutorial_completed IS NULL 
  OR ai_tutorial_completed IS NULL 
  OR collaboration_tutorial_completed IS NULL; 