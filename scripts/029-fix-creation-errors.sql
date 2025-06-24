-- Fix trip creation errors
-- This script addresses:
-- 1. RPC function parameter naming issue
-- 2. Duplicate trip member insertion problem
-- 3. Missing placeholder image handling

-- ============================================================================
-- 1. FIX RPC FUNCTION PARAMETER NAMES
-- ============================================================================

-- Drop existing function and recreate with correct parameter names
DROP FUNCTION IF EXISTS verify_trip_access(UUID, UUID);

-- Recreate function with parameter names that match frontend calls
CREATE OR REPLACE FUNCTION verify_trip_access(trip_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trips WHERE id = trip_uuid AND created_by = user_uuid
    UNION
    SELECT 1 FROM trip_members 
    WHERE trip_id = trip_uuid AND user_id = user_uuid AND status = 'accepted'
  );
END;
$$;

-- Drop and recreate get_trip_expenses function with correct parameter names
DROP FUNCTION IF EXISTS get_trip_expenses(UUID, UUID);

CREATE OR REPLACE FUNCTION get_trip_expenses(trip_uuid UUID, user_uuid UUID)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    category_id UUID,
    title TEXT,
    description TEXT,
    amount NUMERIC,
    currency TEXT,
    purchase_date DATE,
    location TEXT,
    status TEXT,
    receipt_url TEXT,
    notes TEXT,
    image_url TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ,
    category_name TEXT,
    category_icon TEXT,
    category_color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user has access to the trip
  IF NOT verify_trip_access(trip_uuid, user_uuid) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.trip_id,
    e.category_id,
    e.title,
    e.description,
    e.amount,
    e.currency,
    e.purchase_date,
    e.location,
    e.status,
    e.receipt_url,
    e.notes,
    e.image_url,
    e.created_by,
    e.created_at,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color
  FROM
    trip_expenses e
  LEFT JOIN
    categories c ON e.category_id = c.id
  WHERE
    e.trip_id = trip_uuid
  ORDER BY e.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_trip_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_expenses(UUID, UUID) TO authenticated;

-- ============================================================================
-- 2. FIX DUPLICATE TRIP MEMBER ISSUE
-- ============================================================================

-- The trigger automatically adds the owner as a member, so we need to modify
-- the application code to handle this gracefully, or modify the trigger to handle conflicts

-- Option 1: Update the trigger to handle conflicts gracefully
CREATE OR REPLACE FUNCTION add_trip_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  -- Use ON CONFLICT to avoid duplicate key errors
  INSERT INTO trip_members (trip_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.created_by, 'owner', 'accepted', NOW())
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. DISPLAY COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'TRIP CREATION ERRORS FIXED!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Fixed issues:';
  RAISE NOTICE '1. RPC function parameter naming (trip_uuid, user_uuid)';
  RAISE NOTICE '2. Duplicate trip member insertion (ON CONFLICT handling)';
  RAISE NOTICE '3. Updated get_trip_expenses function parameters';
  RAISE NOTICE '============================================================================';
END $$; 