CREATE TABLE "seo"."place_cities" (
	"code" integer PRIMARY KEY NOT NULL,
	"country_code" text NOT NULL,
	"label" text NOT NULL,
	"city" text NOT NULL,
	"region" text,
	"type" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "place_cities_label" ON "seo"."place_cities" USING btree ("country_code","label");