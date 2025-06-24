-- ============================================================================
-- TRIP PLANNER - UPDATE SCRIPT: ADD MISSING FUNCTIONS
-- ============================================================================
-- This script adds the missing functions and triggers to an existing database
-- Run this if you already executed the previous schema but are getting 404 errors

-- ============================================================================
-- 1. ADD MISSING FUNCTIONS
-- ============================================================================

-- Function to process pending invitations when a profile is created
CREATE OR REPLACE FUNCTION process_pending_invitations()
RETURNS TRIGGER AS $$
BEGIN
  -- Add user to trip_members if there are pending invitations
  INSERT INTO trip_members (trip_id, user_id, role, invited_by, status, joined_at)
  SELECT 
    ti.trip_id,
    NEW.id,
    ti.role,
    ti.invited_by,
    'accepted',
    NOW()
  FROM trip_invitations ti
  WHERE ti.email = NEW.email 
  AND ti.status = 'pending'
  AND ti.expires_at > NOW()
  ON CONFLICT (trip_id, user_id) DO NOTHING;

  -- Mark invitations as accepted
  UPDATE trip_invitations 
  SET status = 'accepted'
  WHERE email = NEW.email 
  AND status = 'pending'
  AND expires_at > NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to process existing invitations for users who already exist
-- THIS IS THE MISSING FUNCTION THAT WAS CAUSING THE 404 ERROR
CREATE OR REPLACE FUNCTION process_existing_invitations(user_email TEXT, user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Add to trip_members if there are pending invitations
  INSERT INTO trip_members (trip_id, user_id, role, invited_by, status, joined_at)
  SELECT 
    ti.trip_id,
    user_id,
    ti.role,
    ti.invited_by,
    'accepted',
    NOW()
  FROM trip_invitations ti
  WHERE ti.email = user_email 
  AND ti.status = 'pending'
  AND ti.expires_at > NOW()
  ON CONFLICT (trip_id, user_id) DO NOTHING;

  -- Mark invitations as accepted
  UPDATE trip_invitations 
  SET status = 'accepted'
  WHERE email = user_email 
  AND status = 'pending'
  AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. ADD MISSING TRIGGERS
-- ============================================================================

-- Drop existing trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS trigger_process_pending_invitations ON profiles;

-- Create trigger to process pending invitations when profile is created
CREATE TRIGGER trigger_process_pending_invitations
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION process_pending_invitations();

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on the new function
GRANT EXECUTE ON FUNCTION process_existing_invitations(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_pending_invitations() TO authenticated;

-- ============================================================================
-- 4. VERIFY MISSING COLUMNS (in case they don't exist)
-- ============================================================================

-- Add email_status column to trip_invitations if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trip_invitations' 
    AND column_name = 'email_status'
  ) THEN
    ALTER TABLE trip_invitations 
    ADD COLUMN email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed'));
  END IF;
END $$;

-- Add sent_at column to trip_invitations if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trip_invitations' 
    AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE trip_invitations 
    ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add image_url column to activities if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' 
    AND column_name = 'image_url'
  ) THEN
    ALTER TABLE activities 
    ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- Add image_url column to expenses if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' 
    AND column_name = 'image_url'
  ) THEN
    ALTER TABLE expenses 
    ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- Add image_url column to trip_expenses if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trip_expenses' 
    AND column_name = 'image_url'
  ) THEN
    ALTER TABLE trip_expenses 
    ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- ============================================================================
-- 5. UPDATE STORAGE POLICIES (if buckets don't exist)
-- ============================================================================

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('trip-items', 'trip-items', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

-- Check if the function exists now
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'process_existing_invitations'
  ) THEN
    RAISE NOTICE '✅ Function process_existing_invitations created successfully!';
  ELSE
    RAISE NOTICE '❌ Function process_existing_invitations was NOT created!';
  END IF;
END $$;

-- Display completion message
DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'TRIP PLANNER UPDATE COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ Added missing function: process_existing_invitations';
  RAISE NOTICE '✅ Added missing function: process_pending_invitations';
  RAISE NOTICE '✅ Added missing trigger: trigger_process_pending_invitations';
  RAISE NOTICE '✅ Verified all required columns exist';
  RAISE NOTICE '✅ Updated storage bucket configuration';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'The 404 error should now be resolved!';
  RAISE NOTICE 'Your Trip Planner application should work correctly now.';
  RAISE NOTICE '============================================================================';
END $$; 