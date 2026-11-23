CREATE TABLE "seo"."place_categories" (
	"name" text PRIMARY KEY NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
