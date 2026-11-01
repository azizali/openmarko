CREATE TABLE "seo"."backlinks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"website_id" uuid NOT NULL,
	"source_domain" text NOT NULL,
	"url" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lost_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "seo"."grid_points" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"scan_id" uuid NOT NULL,
	"row" integer NOT NULL,
	"col" integer NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"rank" integer
);
--> statement-breakpoint
CREATE TABLE "seo"."grid_scans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"size" integer NOT NULL,
	"step_km" double precision NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."review_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_name" text,
	"status" text NOT NULL,
	"message_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo"."backlinks" ADD CONSTRAINT "backlinks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."backlinks" ADD CONSTRAINT "backlinks_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "core"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."grid_points" ADD CONSTRAINT "grid_points_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."grid_points" ADD CONSTRAINT "grid_points_scan_id_grid_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "seo"."grid_scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."grid_scans" ADD CONSTRAINT "grid_scans_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."grid_scans" ADD CONSTRAINT "grid_scans_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."review_requests" ADD CONSTRAINT "review_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."review_requests" ADD CONSTRAINT "review_requests_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "backlinks_site_source" ON "seo"."backlinks" USING btree ("website_id","source_domain");--> statement-breakpoint
CREATE INDEX "grid_points_scan" ON "seo"."grid_points" USING btree ("scan_id");