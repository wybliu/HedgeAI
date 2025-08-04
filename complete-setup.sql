-- Complete Setup Script for Hedge Academy Chat Application
-- Run this in your Supabase SQL Editor

-- Step 1: Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create chat_sessions table FIRST (before chat_history)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create chat_history table with session_id column
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content TEXT NOT NULL,
  files JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create answer_keys table
CREATE TABLE IF NOT EXISTS answer_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Add foreign key constraint to chat_history
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_chat_history_session_id'
    ) THEN
        ALTER TABLE chat_history 
        ADD CONSTRAINT fk_chat_history_session_id 
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 6: Migrate existing chat_history data (if any)
DO $$
BEGIN
    -- Check if there are any chat_history records without session_id
    IF EXISTS (
        SELECT 1 FROM chat_history WHERE session_id IS NULL
    ) THEN
        -- Create default sessions for existing messages
        INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
        SELECT 
            gen_random_uuid(),
            user_id,
            'Migrated Chat',
            MIN(created_at),
            MAX(created_at)
        FROM chat_history 
        WHERE session_id IS NULL
        GROUP BY user_id;
        
        -- Update existing chat_history records with session_id
        UPDATE chat_history 
        SET session_id = (
            SELECT cs.id 
            FROM chat_sessions cs 
            WHERE cs.user_id = chat_history.user_id 
            LIMIT 1
        )
        WHERE session_id IS NULL;
        
        RAISE NOTICE 'Successfully migrated existing chat data';
    END IF;
END $$;

-- Step 7: Make session_id NOT NULL after migration
ALTER TABLE chat_history ALTER COLUMN session_id SET NOT NULL;

-- Step 8: Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_keys ENABLE ROW LEVEL SECURITY;

-- Step 9: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answer_keys_user_id ON answer_keys(user_id);

-- Step 10: Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- Step 11: Create RLS policies for chat_sessions
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
CREATE POLICY "Users can view own chat sessions" ON chat_sessions
  FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own chat sessions" ON chat_sessions;
CREATE POLICY "Users can insert own chat sessions" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own chat sessions" ON chat_sessions;
CREATE POLICY "Users can update own chat sessions" ON chat_sessions
  FOR UPDATE USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own chat sessions" ON chat_sessions;
CREATE POLICY "Users can delete own chat sessions" ON chat_sessions
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Step 12: Create RLS policies for chat_history
DROP POLICY IF EXISTS "Users can view own chat history" ON chat_history;
CREATE POLICY "Users can view own chat history" ON chat_history
  FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own chat history" ON chat_history;
CREATE POLICY "Users can insert own chat history" ON chat_history
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Step 13: Create RLS policies for answer_keys
DROP POLICY IF EXISTS "Users can view own answer keys" ON answer_keys;
CREATE POLICY "Users can view own answer keys" ON answer_keys
  FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own answer keys" ON answer_keys;
CREATE POLICY "Users can insert own answer keys" ON answer_keys
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own answer keys" ON answer_keys;
CREATE POLICY "Users can update own answer keys" ON answer_keys
  FOR UPDATE USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own answer keys" ON answer_keys;
CREATE POLICY "Users can delete own answer keys" ON answer_keys
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Success message
SELECT 'Database setup completed successfully!' as status; 