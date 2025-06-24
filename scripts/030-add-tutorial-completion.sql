-- Add tutorial completion tracking to profiles table
ALTER TABLE profiles 
ADD COLUMN tutorial_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to have tutorial_completed as false
UPDATE profiles 
SET tutorial_completed = FALSE 
WHERE tutorial_completed IS NULL; 