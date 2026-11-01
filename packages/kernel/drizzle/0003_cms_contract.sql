ALTER TABLE "integrations"."connections" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "seo"."articles" ADD COLUMN "published_url" text;--> statement-breakpoint
ALTER TABLE "seo"."articles" ADD COLUMN "external_id" text;