CREATE TABLE "seo"."audit_links" (
	"check_id" uuid NOT NULL,
	"from_url" text NOT NULL,
	"to_url" text NOT NULL,
	"anchor" text,
	CONSTRAINT "audit_links_check_id_from_url_to_url_pk" PRIMARY KEY("check_id","from_url","to_url")
);
--> statement-breakpoint
ALTER TABLE "seo"."audit_pages" ADD COLUMN "h1" text;--> statement-breakpoint
ALTER TABLE "seo"."audit_links" ADD CONSTRAINT "audit_links_check_id_site_audits_check_id_fk" FOREIGN KEY ("check_id") REFERENCES "seo"."site_audits"("check_id") ON DELETE cascade ON UPDATE no action;