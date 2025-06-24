-- Add summary_tutorial_completed field to profiles table
ALTER TABLE profiles 
ADD COLUMN summary_tutorial_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to have summary tutorial not completed
UPDATE profiles 
SET summary_tutorial_completed = FALSE 
WHERE summary_tutorial_completed IS NULL; 