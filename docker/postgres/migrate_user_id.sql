-- Migration script to add user_id column to conversation_history table
-- This fixes the security issue where users could see each other's messages

-- Add user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversation_history' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE conversation_history ADD COLUMN user_id VARCHAR(255);
        
        -- Set a default user_id for existing records (you may want to clean these up later)
        UPDATE conversation_history SET user_id = 'legacy-user' WHERE user_id IS NULL;
        
        -- Make the column NOT NULL after setting default values
        ALTER TABLE conversation_history ALTER COLUMN user_id SET NOT NULL;
        
        -- Create index for the new column
        CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_history_user_idx ON conversation_history(user_id);
        
        RAISE NOTICE 'Added user_id column to conversation_history table';
    ELSE
        RAISE NOTICE 'user_id column already exists in conversation_history table';
    END IF;
END $$;

-- Clean up legacy data (optional - uncomment if you want to remove old messages)
-- DELETE FROM conversation_history WHERE user_id = 'legacy-user'; 