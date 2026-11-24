CREATE TABLE "seo"."audit_issues" (
	"check_id" uuid NOT NULL,
	"code" text NOT NULL,
	"count" integer NOT NULL,
	"items" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "audit_issues_check_id_code_pk" PRIMARY KEY("check_id","code")
);
--> statement-breakpoint
CREATE TABLE "seo"."audit_pages" (
	"check_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status_code" smallint NOT NULL,
	"depth" smallint,
	"title" text,
	"word_count" integer,
	"load_ms" integer,
	"issues" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "audit_pages_check_id_url_pk" PRIMARY KEY("check_id","url")
);
--> statement-breakpoint
CREATE TABLE "seo"."site_audits" (
	"check_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"pages_crawled" integer NOT NULL,
	"health" smallint NOT NULL,
	"home_url" text NOT NULL,
	"schema_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"phones" text[] DEFAULT '{}'::text[] NOT NULL,
	"blocked_bots" text[] DEFAULT '{}'::text[] NOT NULL,
	"llms_txt" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo"."audit_issues" ADD CONSTRAINT "audit_issues_check_id_site_audits_check_id_fk" FOREIGN KEY ("check_id") REFERENCES "seo"."site_audits"("check_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."audit_pages" ADD CONSTRAINT "audit_pages_check_id_site_audits_check_id_fk" FOREIGN KEY ("check_id") REFERENCES "seo"."site_audits"("check_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."site_audits" ADD CONSTRAINT "site_audits_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "seo"."checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."site_audits" ADD CONSTRAINT "site_audits_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."site_audits" ADD CONSTRAINT "site_audits_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_audits_location" ON "seo"."site_audits" USING btree ("location_id","checked_at");--> statement-breakpoint
-- DataForSEO now also audits sites (site.audit). A Connection keeps the capabilities it was made with, so the ones
-- made before this get it here.
UPDATE "integrations"."connections" SET "capabilities" = array_append("capabilities", 'site.audit') WHERE "provider_id" = 'dataforseo' AND NOT ("capabilities" @> ARRAY['site.audit']::text[]);
