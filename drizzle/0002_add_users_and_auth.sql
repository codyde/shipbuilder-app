-- Add users table for authentication
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "provider" text,
  "provider_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add unique constraint on email
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
--> statement-breakpoint

-- Insert a default user for existing projects
INSERT INTO "users" ("id", "email", "name", "provider") VALUES ('00000000-0000-0000-0000-000000000000', 'default@example.com', 'Default User', 'fake');
--> statement-breakpoint

-- Add userId column to projects table to associate projects with users
ALTER TABLE "projects" ADD COLUMN "user_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
--> statement-breakpoint

-- Add foreign key constraint for projects user_id
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;