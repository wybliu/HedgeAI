-- Temporary script to disable RLS for testing
-- WARNING: Only run this for testing, not in production!

-- Disable RLS on chat_sessions temporarily
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;

-- Test if we can insert a session now
-- This will help us determine if the issue is RLS-related

-- After testing, re-enable RLS:
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY; 