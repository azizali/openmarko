CREATE TABLE "seo"."key_page_keywords" (
	"keyword_id" uuid PRIMARY KEY NOT NULL,
	"key_page_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."key_pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"path" text NOT NULL,
	"status" text DEFAULT 'key' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo"."key_page_keywords" ADD CONSTRAINT "key_page_keywords_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."key_page_keywords" ADD CONSTRAINT "key_page_keywords_key_page_id_key_pages_id_fk" FOREIGN KEY ("key_page_id") REFERENCES "seo"."key_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."key_pages" ADD CONSTRAINT "key_pages_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."key_pages" ADD CONSTRAINT "key_pages_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "key_pages_path" ON "seo"."key_pages" USING btree ("location_id","path");