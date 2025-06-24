-- Update expenses table to link with activities
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES activities(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_activity_id ON expenses(activity_id);
