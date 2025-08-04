-- Test script to check session creation and RLS policies
-- Run this in Supabase SQL Editor

-- Check if user is authenticated
SELECT auth.uid() as current_user_id;

-- Check if chat_sessions table exists and has correct structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'chat_sessions' 
ORDER BY ordinal_position;

-- Check RLS policies on chat_sessions
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'chat_sessions';

-- Test inserting a session (this will fail if RLS is blocking it)
-- Replace 'your-user-id-here' with an actual user ID from your auth.users table
-- INSERT INTO chat_sessions (user_id, title) VALUES ('your-user-id-here', 'Test Session');

-- Check if there are any existing sessions
SELECT * FROM chat_sessions LIMIT 5; 