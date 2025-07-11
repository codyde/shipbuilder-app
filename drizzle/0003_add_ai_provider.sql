-- Create AI provider enum
CREATE TYPE ai_provider AS ENUM ('anthropic', 'openai');

-- Add AI provider column to users table
ALTER TABLE users 
ADD COLUMN ai_provider ai_provider NOT NULL DEFAULT 'anthropic';