CREATE TABLE "integrations"."provider_originals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"capability" text NOT NULL,
	"ref" text NOT NULL,
	"organization_id" text,
	"file_key" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations"."provider_originals" ADD CONSTRAINT "provider_originals_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_originals_ref" ON "integrations"."provider_originals" USING btree ("provider_id","ref");--> statement-breakpoint
CREATE INDEX "provider_originals_created" ON "integrations"."provider_originals" USING btree ("created_at");