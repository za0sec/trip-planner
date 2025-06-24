-- Check if profiles table exists and has data
SELECT 'profiles table' as table_name, count(*) as record_count FROM profiles
UNION ALL
SELECT 'trips table' as table_name, count(*) as record_count FROM trips;

-- Show all profiles
SELECT id, email, full_name, created_at FROM profiles;

-- Show auth users (this might not work in some environments)
-- SELECT id, email, created_at FROM auth.users LIMIT 5;
