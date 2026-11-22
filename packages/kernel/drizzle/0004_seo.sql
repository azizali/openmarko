CREATE SCHEMA "seo";
--> statement-breakpoint
CREATE TABLE "seo"."ai_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"check_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"engine" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"named_you" boolean NOT NULL,
	"your_position" smallint,
	"excerpt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."ai_citations" (
	"answer_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"domain" text NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "ai_citations_answer_id_position_pk" PRIMARY KEY("answer_id","position")
);
--> statement-breakpoint
CREATE TABLE "seo"."ai_mentions" (
	"answer_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	"place_id" uuid,
	CONSTRAINT "ai_mentions_answer_id_position_pk" PRIMARY KEY("answer_id","position")
);
--> statement-breakpoint
CREATE TABLE "seo"."checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"run_id" uuid,
	"queue" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"error" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "seo"."competitor_overrides" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."keyword_metrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"term" text NOT NULL,
	"country_code" text NOT NULL,
	"language_code" text NOT NULL,
	"monthly_searches" integer,
	"cpc" double precision,
	"competition" double precision,
	"trend" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."keywords" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"term" text NOT NULL,
	"metric_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"source" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"website_id" uuid,
	"place_id" uuid,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"country_code" text DEFAULT 'US' NOT NULL,
	"language_code" text DEFAULT 'en' NOT NULL,
	"services" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text NOT NULL,
	"grid_size" smallint DEFAULT 7 NOT NULL,
	"grid_radius_m" integer DEFAULT 3000 NOT NULL,
	"check_every" text DEFAULT 'weekly' NOT NULL,
	"engines" text[] DEFAULT '{chatgpt,google_ai,perplexity}'::text[] NOT NULL,
	"gbp_connection_id" uuid,
	"gbp_location_name" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."map_points" (
	"scan_id" uuid NOT NULL,
	"idx" smallint NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"your_rank" smallint,
	"ranking" uuid[] NOT NULL,
	CONSTRAINT "map_points_scan_id_idx_pk" PRIMARY KEY("scan_id","idx")
);
--> statement-breakpoint
CREATE TABLE "seo"."map_scans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"check_id" uuid NOT NULL,
	"keyword_id" uuid NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"grid_size" smallint NOT NULL,
	"radius_m" integer NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"your_top3_spots" smallint NOT NULL,
	"your_avg_position" double precision NOT NULL,
	"your_door_position" smallint
);
--> statement-breakpoint
CREATE TABLE "seo"."map_standings" (
	"scan_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"top3_spots" smallint NOT NULL,
	"avg_position" double precision NOT NULL,
	"door_position" smallint,
	"best_side" text,
	"worst_side" text,
	CONSTRAINT "map_standings_scan_id_place_id_pk" PRIMARY KEY("scan_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "seo"."place_snapshots" (
	"place_id" uuid NOT NULL,
	"observed_on" date NOT NULL,
	"rating" double precision,
	"review_count" integer,
	"photo_count" integer,
	"is_claimed" boolean,
	"source" text NOT NULL,
	CONSTRAINT "place_snapshots_place_id_observed_on_pk" PRIMARY KEY("place_id","observed_on")
);
--> statement-breakpoint
CREATE TABLE "seo"."places" (
	"id" uuid PRIMARY KEY NOT NULL,
	"google_place_id" text NOT NULL,
	"cid" text,
	"name" text NOT NULL,
	"primary_category" text,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"domain" text,
	"phone" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."profile_metrics" (
	"location_id" uuid NOT NULL,
	"day" date NOT NULL,
	"organization_id" text NOT NULL,
	"calls" integer NOT NULL,
	"website_clicks" integer NOT NULL,
	"direction_requests" integer NOT NULL,
	"impressions_maps" integer NOT NULL,
	"impressions_search" integer NOT NULL,
	CONSTRAINT "profile_metrics_location_id_day_pk" PRIMARY KEY("location_id","day")
);
--> statement-breakpoint
CREATE TABLE "seo"."profile_search_terms" (
	"location_id" uuid NOT NULL,
	"month" date NOT NULL,
	"term" text NOT NULL,
	"organization_id" text NOT NULL,
	"impressions" integer NOT NULL,
	CONSTRAINT "profile_search_terms_location_id_month_term_pk" PRIMARY KEY("location_id","month","term")
);
--> statement-breakpoint
CREATE TABLE "seo"."provider_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"check_id" uuid NOT NULL,
	"external_task_id" text NOT NULL,
	"target" jsonb NOT NULL,
	"status" text NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"raw" jsonb,
	"error" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "seo"."questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"text" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."serp_items" (
	"result_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"domain" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"item_type" text NOT NULL,
	"place_id" uuid,
	CONSTRAINT "serp_items_result_id_position_pk" PRIMARY KEY("result_id","position")
);
--> statement-breakpoint
CREATE TABLE "seo"."serp_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"check_id" uuid NOT NULL,
	"keyword_id" uuid NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"your_position" smallint,
	"your_url" text,
	"has_map_pack" boolean NOT NULL,
	"has_ai_overview" boolean NOT NULL,
	"ai_overview_cites_you" boolean NOT NULL,
	"people_also_ask" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."suggestions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"helps" text NOT NULL,
	"title" text NOT NULL,
	"why" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"fingerprint" text NOT NULL,
	"status" text NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"check_id" uuid,
	"task_id" uuid,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."websites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo"."ai_answers" ADD CONSTRAINT "ai_answers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_answers" ADD CONSTRAINT "ai_answers_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_answers" ADD CONSTRAINT "ai_answers_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "seo"."checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_answers" ADD CONSTRAINT "ai_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "seo"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_citations" ADD CONSTRAINT "ai_citations_answer_id_ai_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "seo"."ai_answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_mentions" ADD CONSTRAINT "ai_mentions_answer_id_ai_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "seo"."ai_answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_mentions" ADD CONSTRAINT "ai_mentions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "seo"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."checks" ADD CONSTRAINT "checks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."checks" ADD CONSTRAINT "checks_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."competitor_overrides" ADD CONSTRAINT "competitor_overrides_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."competitor_overrides" ADD CONSTRAINT "competitor_overrides_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."competitor_overrides" ADD CONSTRAINT "competitor_overrides_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "seo"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."keywords" ADD CONSTRAINT "keywords_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."keywords" ADD CONSTRAINT "keywords_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."keywords" ADD CONSTRAINT "keywords_metric_id_keyword_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "seo"."keyword_metrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."locations" ADD CONSTRAINT "locations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."locations" ADD CONSTRAINT "locations_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "seo"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."locations" ADD CONSTRAINT "locations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "seo"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."map_points" ADD CONSTRAINT "map_points_scan_id_map_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "seo"."map_scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."map_scans" ADD CONSTRAINT "map_scans_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."map_scans" ADD CONSTRAINT "map_scans_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."map_scans" ADD CONSTRAINT "map_scans_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "seo"."checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."map_scans" ADD CONSTRAINT "map_scans_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."map_standings" ADD CONSTRAINT "map_standings_scan_id_map_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "seo"."map_scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."map_standings" ADD CONSTRAINT "map_standings_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "seo"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."place_snapshots" ADD CONSTRAINT "place_snapshots_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "seo"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."profile_metrics" ADD CONSTRAINT "profile_metrics_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."profile_metrics" ADD CONSTRAINT "profile_metrics_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."profile_search_terms" ADD CONSTRAINT "profile_search_terms_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."profile_search_terms" ADD CONSTRAINT "profile_search_terms_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."provider_tasks" ADD CONSTRAINT "provider_tasks_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "seo"."checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."questions" ADD CONSTRAINT "questions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."questions" ADD CONSTRAINT "questions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."serp_items" ADD CONSTRAINT "serp_items_result_id_serp_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "seo"."serp_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."serp_items" ADD CONSTRAINT "serp_items_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "seo"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."serp_results" ADD CONSTRAINT "serp_results_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."serp_results" ADD CONSTRAINT "serp_results_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."serp_results" ADD CONSTRAINT "serp_results_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "seo"."checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."serp_results" ADD CONSTRAINT "serp_results_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."suggestions" ADD CONSTRAINT "suggestions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."suggestions" ADD CONSTRAINT "suggestions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "seo"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."suggestions" ADD CONSTRAINT "suggestions_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "seo"."checks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."websites" ADD CONSTRAINT "websites_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_answers_location" ON "seo"."ai_answers" USING btree ("location_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_answers_check" ON "seo"."ai_answers" USING btree ("check_id","question_id","engine");--> statement-breakpoint
CREATE INDEX "ai_citations_domain" ON "seo"."ai_citations" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "checks_location" ON "seo"."checks" USING btree ("location_id","kind","queued_at");--> statement-breakpoint
CREATE INDEX "checks_run" ON "seo"."checks" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competitor_overrides_place" ON "seo"."competitor_overrides" USING btree ("location_id","place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_metrics_key" ON "seo"."keyword_metrics" USING btree ("term","country_code","language_code");--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_term" ON "seo"."keywords" USING btree ("location_id","term");--> statement-breakpoint
CREATE INDEX "locations_org" ON "seo"."locations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "map_scans_location" ON "seo"."map_scans" USING btree ("location_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "map_scans_check_keyword" ON "seo"."map_scans" USING btree ("check_id","keyword_id");--> statement-breakpoint
CREATE INDEX "map_standings_place" ON "seo"."map_standings" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "places_google" ON "seo"."places" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX "places_domain" ON "seo"."places" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_tasks_external" ON "seo"."provider_tasks" USING btree ("external_task_id");--> statement-breakpoint
CREATE INDEX "provider_tasks_waiting" ON "seo"."provider_tasks" USING btree ("posted_at") WHERE status = 'posted';--> statement-breakpoint
CREATE INDEX "provider_tasks_check" ON "seo"."provider_tasks" USING btree ("check_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_text" ON "seo"."questions" USING btree ("location_id","text");--> statement-breakpoint
CREATE INDEX "serp_items_domain" ON "seo"."serp_items" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "serp_results_location" ON "seo"."serp_results" USING btree ("location_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "serp_results_check_keyword" ON "seo"."serp_results" USING btree ("check_id","keyword_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suggestions_fingerprint" ON "seo"."suggestions" USING btree ("location_id","fingerprint");--> statement-breakpoint
CREATE INDEX "suggestions_open" ON "seo"."suggestions" USING btree ("location_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "websites_domain" ON "seo"."websites" USING btree ("organization_id","domain");