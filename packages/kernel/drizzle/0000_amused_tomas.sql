CREATE SCHEMA "automation";
--> statement-breakpoint
CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE SCHEMA "integrations";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "seo";
--> statement-breakpoint
CREATE TABLE "automation"."runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"progress" double precision DEFAULT 0 NOT NULL,
	"expected_sec" integer,
	"target_type" text,
	"target_id" uuid,
	"schedule_id" uuid,
	"created_by" text,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"error" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "automation"."schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"job_id" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"every" text NOT NULL,
	"at" text,
	"paused" boolean DEFAULT false NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation"."tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"feature_id" text NOT NULL,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"why" text,
	"impact" text,
	"target_type" text,
	"target_id" uuid,
	"source_type" text,
	"source_id" uuid,
	"preview" jsonb,
	"payload" jsonb NOT NULL,
	"revert" jsonb,
	"autopilot" boolean DEFAULT false NOT NULL,
	"created_by_type" text NOT NULL,
	"created_by" text,
	"applied_by" text,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."entitlement_overrides" (
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"value" bigint,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_overrides_organization_id_key_pk" PRIMARY KEY("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "billing"."plan_entitlements" (
	"plan_id" text NOT NULL,
	"key" text NOT NULL,
	"value" bigint,
	CONSTRAINT "plan_entitlements_plan_id_key_pk" PRIMARY KEY("plan_id","key")
);
--> statement-breakpoint
CREATE TABLE "billing"."plan_meters" (
	"plan_id" text NOT NULL,
	"meter" text NOT NULL,
	"included" bigint,
	"overage" text NOT NULL,
	"unit_price_micros" bigint,
	CONSTRAINT "plan_meters_plan_id_meter_pk" PRIMARY KEY("plan_id","meter")
);
--> statement-breakpoint
CREATE TABLE "billing"."plan_prices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"interval" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"provider_price_id" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"price_id" uuid,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_provider_subscription_id_unique" UNIQUE("provider_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "billing"."usage_events" (
	"id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"meter" text NOT NULL,
	"quantity" bigint NOT NULL,
	"cost_micros" bigint NOT NULL,
	"provider" text NOT NULL,
	"mode" text NOT NULL,
	"run_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb,
	CONSTRAINT "usage_events_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
) PARTITION BY RANGE ("occurred_at");
--> statement-breakpoint
CREATE TABLE "integrations"."connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text,
	"provider_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"external_id" text,
	"label" text NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"status_note" text,
	"capabilities" text[] NOT NULL,
	"mode" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integrations"."credentials" (
	"connection_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text,
	"ciphertext" "bytea" NOT NULL,
	"wrapped_key" "bytea" NOT NULL,
	"key_version" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integrations"."webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"external_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "core"."locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"country" text DEFAULT 'US' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"phone" text,
	"timezone" text,
	"place_id" text,
	"gbp_id" text,
	"gbp_connection_id" uuid,
	"website_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."websites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."ai_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"question_id" uuid NOT NULL,
	"engine" text NOT NULL,
	"listed" jsonb NOT NULL,
	"mentioned" boolean NOT NULL,
	"run_id" uuid,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."ai_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"text" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"website_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "seo"."audit_issues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"audit_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"severity" text NOT NULL,
	"url" text NOT NULL,
	"detail" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."audits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"website_id" uuid NOT NULL,
	"status" text NOT NULL,
	"pages_crawled" integer DEFAULT 0 NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."citations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"directory" text NOT NULL,
	"status" text NOT NULL,
	"url" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."competitors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."keywords" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"term" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."profile_insights" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"day" date NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"directions" integer DEFAULT 0 NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo"."rank_snapshots" (
	"id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"keyword_id" uuid NOT NULL,
	"organic_rank" integer,
	"map_rank" integer,
	"top_domain" text,
	"run_id" uuid,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
) PARTITION BY RANGE ("checked_at");
--> statement-breakpoint
CREATE TABLE "seo"."reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reply" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."settings" (
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"namespace" text NOT NULL,
	"value" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_scope_type_scope_id_namespace_pk" PRIMARY KEY("scope_type","scope_id","namespace")
);
--> statement-breakpoint
CREATE TABLE "core"."activity" (
	"id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"location_id" uuid,
	"summary" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_id_created_at_pk" PRIMARY KEY("id","created_at")
) PARTITION BY RANGE ("created_at");
--> statement-breakpoint
CREATE TABLE "core"."outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"organization_id" text,
	"payload" jsonb NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."outbox_handled" (
	"event_id" uuid NOT NULL,
	"handler" text NOT NULL,
	"handled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_handled_event_id_handler_pk" PRIMARY KEY("event_id","handler")
);
--> statement-breakpoint
ALTER TABLE "automation"."runs" ADD CONSTRAINT "runs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation"."runs" ADD CONSTRAINT "runs_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "automation"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation"."schedules" ADD CONSTRAINT "schedules_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation"."tasks" ADD CONSTRAINT "tasks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."entitlement_overrides" ADD CONSTRAINT "entitlement_overrides_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."plan_meters" ADD CONSTRAINT "plan_meters_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."plan_prices" ADD CONSTRAINT "plan_prices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."usage_events" ADD CONSTRAINT "usage_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."connections" ADD CONSTRAINT "connections_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."credentials" ADD CONSTRAINT "credentials_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "integrations"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."locations" ADD CONSTRAINT "locations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."websites" ADD CONSTRAINT "websites_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_answers" ADD CONSTRAINT "ai_answers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_answers" ADD CONSTRAINT "ai_answers_question_id_ai_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "seo"."ai_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_questions" ADD CONSTRAINT "ai_questions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."ai_questions" ADD CONSTRAINT "ai_questions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."articles" ADD CONSTRAINT "articles_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."articles" ADD CONSTRAINT "articles_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "core"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."audit_issues" ADD CONSTRAINT "audit_issues_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."audit_issues" ADD CONSTRAINT "audit_issues_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "seo"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."audits" ADD CONSTRAINT "audits_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."audits" ADD CONSTRAINT "audits_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "core"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."citations" ADD CONSTRAINT "citations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."citations" ADD CONSTRAINT "citations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."competitors" ADD CONSTRAINT "competitors_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."competitors" ADD CONSTRAINT "competitors_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."keywords" ADD CONSTRAINT "keywords_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."keywords" ADD CONSTRAINT "keywords_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."profile_insights" ADD CONSTRAINT "profile_insights_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."profile_insights" ADD CONSTRAINT "profile_insights_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."rank_snapshots" ADD CONSTRAINT "rank_snapshots_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."rank_snapshots" ADD CONSTRAINT "rank_snapshots_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."reviews" ADD CONSTRAINT "reviews_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo"."reviews" ADD CONSTRAINT "reviews_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."activity" ADD CONSTRAINT "activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_org_time" ON "automation"."runs" USING btree ("organization_id","queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_unique" ON "automation"."schedules" USING btree ("organization_id","job_id","target_id");--> statement-breakpoint
CREATE INDEX "schedules_due" ON "automation"."schedules" USING btree ("next_run_at") WHERE paused = false;--> statement-breakpoint
CREATE INDEX "tasks_org_status" ON "automation"."tasks" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_open_source" ON "automation"."tasks" USING btree ("organization_id","kind","source_id") WHERE status = 'open' and source_id is not null;--> statement-breakpoint
CREATE INDEX "plan_prices_plan" ON "billing"."plan_prices" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "subscriptions_org" ON "billing"."subscriptions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "usage_org_meter" ON "billing"."usage_events" USING btree ("organization_id","meter","occurred_at");--> statement-breakpoint
CREATE INDEX "connections_org_target" ON "integrations"."connections" USING btree ("organization_id","target_type","target_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "connections_external" ON "integrations"."connections" USING btree ("provider_id","external_id","target_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_external" ON "integrations"."webhook_events" USING btree ("provider_id","external_id");--> statement-breakpoint
CREATE INDEX "locations_org" ON "core"."locations" USING btree ("organization_id") WHERE archived_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_gbp_id" ON "core"."locations" USING btree ("gbp_id") WHERE gbp_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "websites_org_domain" ON "core"."websites" USING btree ("organization_id","domain");--> statement-breakpoint
CREATE INDEX "ai_answers_question" ON "seo"."ai_answers" USING btree ("question_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_questions_loc_text" ON "seo"."ai_questions" USING btree ("location_id","text");--> statement-breakpoint
CREATE INDEX "articles_website" ON "seo"."articles" USING btree ("website_id","status");--> statement-breakpoint
CREATE INDEX "audit_issues_audit" ON "seo"."audit_issues" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "audits_website" ON "seo"."audits" USING btree ("website_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "citations_loc_dir" ON "seo"."citations" USING btree ("location_id","directory");--> statement-breakpoint
CREATE UNIQUE INDEX "competitors_loc_name" ON "seo"."competitors" USING btree ("location_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_loc_term" ON "seo"."keywords" USING btree ("location_id","term");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_insights_day" ON "seo"."profile_insights" USING btree ("location_id","day");--> statement-breakpoint
CREATE INDEX "rank_snapshots_keyword" ON "seo"."rank_snapshots" USING btree ("keyword_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_external" ON "seo"."reviews" USING btree ("location_id","external_id");--> statement-breakpoint
CREATE INDEX "reviews_org_loc" ON "seo"."reviews" USING btree ("organization_id","location_id");--> statement-breakpoint
CREATE INDEX "activity_org_time" ON "core"."activity" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_pending" ON "core"."outbox" USING btree ("available_at") WHERE processed_at is null;

--> statement-breakpoint
-- Monthly partitions for the tables that grow with every run (schema.md, "How this scales").
-- A default partition catches anything outside the created months, so an insert can't fail.
-- automation.partitions runs ensure_month_partitions() daily to create the next months ahead.
CREATE OR REPLACE FUNCTION public.ensure_month_partitions(target_schema text, target_table text, months_ahead int DEFAULT 2)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  m date := date_trunc('month', now())::date;
  i int;
  part_name text;
BEGIN
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I DEFAULT', target_schema, target_table || '_default', target_schema, target_table);
  FOR i IN 0..months_ahead LOOP
    part_name := format('%s_%s', target_table, to_char(m + (i || ' months')::interval, 'YYYY_MM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I FOR VALUES FROM (%L) TO (%L)',
      target_schema, part_name, target_schema, target_table,
      (m + (i || ' months')::interval)::timestamptz,
      (m + ((i + 1) || ' months')::interval)::timestamptz
    );
  END LOOP;
END $$;
--> statement-breakpoint
SELECT public.ensure_month_partitions('core', 'activity');
--> statement-breakpoint
SELECT public.ensure_month_partitions('billing', 'usage_events');
--> statement-breakpoint
SELECT public.ensure_month_partitions('seo', 'rank_snapshots');
