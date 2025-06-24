-- First, drop the existing function if it exists to avoid errors on re-creation with changed return type
DROP FUNCTION IF EXISTS get_trip_expenses(UUID, UUID);

-- Recreate the function with image_url
CREATE OR REPLACE FUNCTION get_trip_expenses(p_trip_id UUID, p_user_id UUID)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    category_id UUID,
    title TEXT,
    description TEXT,
    amount NUMERIC, -- Assuming amount is numeric, adjust if it's float or other
    currency TEXT,
    purchase_date DATE,
    location TEXT,
    status TEXT,
    receipt_url TEXT,
    notes TEXT,
    image_url TEXT, -- Added image_url
    created_by UUID,
    created_at TIMESTAMPTZ,
    category_name TEXT,
    category_icon TEXT,
    category_color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the user has access to the trip
  IF NOT verify_trip_access(p_trip_id, p_user_id) THEN
    RETURN; -- Or RAISE EXCEPTION 'Access Denied';
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
    e.image_url, -- Added image_url
    e.created_by,
    e.created_at,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color
  FROM
    expenses e -- Ensure this is your correct expenses table name
  LEFT JOIN
    categories c ON e.category_id = c.id
  WHERE
    e.trip_id = p_trip_id;
END;
$$;
