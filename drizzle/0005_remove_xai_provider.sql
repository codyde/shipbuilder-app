-- Remove legacy 'xai' value from ai_provider enum and normalize existing rows
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_provider_old') THEN
    DROP TYPE ai_provider_old;
  END IF;
END $$;

ALTER TYPE ai_provider RENAME TO ai_provider_old;

CREATE TYPE ai_provider AS ENUM ('anthropic', 'openai');

ALTER TABLE users
  ALTER COLUMN ai_provider TYPE ai_provider
  USING (
    CASE
      WHEN ai_provider::text NOT IN ('anthropic', 'openai') THEN 'anthropic'
      ELSE ai_provider::text
    END
  )::ai_provider;

DROP TYPE ai_provider_old;
