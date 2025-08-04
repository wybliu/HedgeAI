-- Migration script to add session_id column to existing chat_history table
-- Run this in your Supabase SQL Editor

-- First, check if session_id column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_history' 
        AND column_name = 'session_id'
    ) THEN
        -- Add session_id column
        ALTER TABLE chat_history ADD COLUMN session_id UUID;
        
        -- Create a default session for existing messages
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
        
        -- Make session_id NOT NULL after populating it
        ALTER TABLE chat_history ALTER COLUMN session_id SET NOT NULL;
        
        -- Add foreign key constraint
        ALTER TABLE chat_history 
        ADD CONSTRAINT fk_chat_history_session_id 
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Successfully added session_id column and migrated existing data';
    ELSE
        RAISE NOTICE 'session_id column already exists';
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answer_keys_user_id ON answer_keys(user_id);

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view own chat history" ON chat_history;
CREATE POLICY "Users can view own chat history" ON chat_history
  FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own chat history" ON chat_history;
CREATE POLICY "Users can insert own chat history" ON chat_history
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text); 