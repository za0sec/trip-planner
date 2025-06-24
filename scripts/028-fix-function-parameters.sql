-- ============================================================================
-- TRIP PLANNER - FIX FUNCTION PARAMETERS
-- ============================================================================
-- This script fixes the parameter names in the process_existing_invitations function
-- to match what the frontend code is calling

-- Drop the existing function first
DROP FUNCTION IF EXISTS process_existing_invitations(TEXT, UUID);
DROP FUNCTION IF EXISTS process_existing_invitations(user_email TEXT, user_id UUID);

-- Create the function with the correct parameter names that match the frontend call
CREATE OR REPLACE FUNCTION process_existing_invitations(user_email TEXT, user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Log the function call for debugging
  RAISE NOTICE 'Processing invitations for email: %, user_id: %', user_email, user_id;
  
  -- Add to trip_members if there are pending invitations
  INSERT INTO trip_members (trip_id, user_id, role, invited_by, status, joined_at)
  SELECT 
    ti.trip_id,
    process_existing_invitations.user_id,
    ti.role,
    ti.invited_by,
    'accepted',
    NOW()
  FROM trip_invitations ti
  WHERE ti.email = process_existing_invitations.user_email 
  AND ti.status = 'pending'
  AND ti.expires_at > NOW()
  ON CONFLICT (trip_id, user_id) DO NOTHING;

  -- Mark invitations as accepted
  UPDATE trip_invitations 
  SET status = 'accepted'
  WHERE email = process_existing_invitations.user_email 
  AND status = 'pending'
  AND expires_at > NOW();
  
  -- Log completion
  RAISE NOTICE 'Completed processing invitations for: %', user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_existing_invitations(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_existing_invitations(TEXT, UUID) TO anon;

-- Verify the function was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'process_existing_invitations'
  ) THEN
    RAISE NOTICE '✅ Function process_existing_invitations fixed successfully!';
    RAISE NOTICE '✅ Parameters: user_email TEXT, user_id UUID';
    RAISE NOTICE '✅ Security: DEFINER (runs with elevated privileges)';
    RAISE NOTICE '✅ Permissions: granted to authenticated and anon';
  ELSE
    RAISE NOTICE '❌ Function process_existing_invitations was NOT created!';
  END IF;
END $$; 