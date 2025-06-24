-- Add image_url column to activities table
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image_url column to expenses table
-- Note: Your expenses table is named 'expenses', not 'trip_expenses' in the schema.
-- If you have a 'trip_expenses' table you are using elsewhere, adjust accordingly.
-- Based on '001-create-tables.sql' and 'add-item-dialog.tsx', the table is 'expenses'.
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Optional: Add RLS policies for the new columns if needed,
-- but typically if a user can see the item, they can see its image_url.
-- The existing RLS policies on the tables should cover this.
