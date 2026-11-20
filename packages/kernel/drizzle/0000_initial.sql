-- pgvector for knowledge bases: 0.8.0 on Neon and in development (docker-compose.dev.yml).
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE SCHEMA "ai";
--> statement-breakpoint
CREATE SCHEMA "automation";
--> statement-breakpoint
CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE SCHEMA "integrations";
--> statement-breakpoint
CREATE SCHEMA "knowledge";
--> statement-breakpoint
CREATE SCHEMA "partners";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TABLE "ai"."assistants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"model" text,
	"knowledge_base_ids" uuid[] DEFAULT '{}' NOT NULL,
	"widget" jsonb DEFAULT '{"enabled":false,"allowedOrigins":[],"greeting":"Hi! How can I help?","accent":"#db2777"}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai"."conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"assistant_id" uuid,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai"."messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"model_id" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_micros" bigint,
	"sources" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
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
	"description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "integrations"."connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text,
	"provider_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"external_id" text,
	"label" text NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"status_note" text,
	"capabilities" text[] NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
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
CREATE TABLE "knowledge"."bases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"embedding_model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge"."chunks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"base_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"text" text NOT NULL,
	"tokens" integer NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" vector NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED
);
--> statement-breakpoint
CREATE TABLE "knowledge"."documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"base_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"source_url" text,
	"source" "bytea",
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners"."domains" (
	"host" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"verify_token" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners"."requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"client_id" text NOT NULL,
	"status" text NOT NULL,
	"requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
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
	"organization_id" text,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"summary" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_id_created_at_pk" PRIMARY KEY("id","created_at")
);
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
ALTER TABLE "ai"."assistants" ADD CONSTRAINT "assistants_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai"."conversations" ADD CONSTRAINT "conversations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai"."conversations" ADD CONSTRAINT "conversations_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "ai"."assistants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "ai"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation"."runs" ADD CONSTRAINT "runs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation"."runs" ADD CONSTRAINT "runs_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "automation"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation"."schedules" ADD CONSTRAINT "schedules_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation"."tasks" ADD CONSTRAINT "tasks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."entitlement_overrides" ADD CONSTRAINT "entitlement_overrides_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."plan_meters" ADD CONSTRAINT "plan_meters_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."plan_prices" ADD CONSTRAINT "plan_prices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."usage_events" ADD CONSTRAINT "usage_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."connections" ADD CONSTRAINT "connections_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."credentials" ADD CONSTRAINT "credentials_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "integrations"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge"."bases" ADD CONSTRAINT "bases_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge"."chunks" ADD CONSTRAINT "chunks_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "knowledge"."bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge"."chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "knowledge"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge"."documents" ADD CONSTRAINT "documents_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "knowledge"."bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners"."domains" ADD CONSTRAINT "domains_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners"."requests" ADD CONSTRAINT "requests_partner_id_organization_id_fk" FOREIGN KEY ("partner_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners"."requests" ADD CONSTRAINT "requests_client_id_organization_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."activity" ADD CONSTRAINT "activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistants_org" ON "ai"."assistants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversations_member" ON "ai"."conversations" USING btree ("organization_id","user_id","updated_at");--> statement-breakpoint
CREATE INDEX "messages_conversation" ON "ai"."messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "runs_org_time" ON "automation"."runs" USING btree ("organization_id","queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_unique" ON "automation"."schedules" USING btree ("organization_id","job_id","target_id");--> statement-breakpoint
CREATE INDEX "schedules_due" ON "automation"."schedules" USING btree ("next_run_at") WHERE paused = false;--> statement-breakpoint
CREATE INDEX "tasks_org_status" ON "automation"."tasks" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_open_source" ON "automation"."tasks" USING btree ("organization_id","kind","source_id") WHERE status = 'open' and source_id is not null;--> statement-breakpoint
CREATE INDEX "plan_prices_plan" ON "billing"."plan_prices" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_default" ON "billing"."plans" USING btree ("is_default") WHERE "billing"."plans"."is_default";--> statement-breakpoint
CREATE INDEX "subscriptions_org" ON "billing"."subscriptions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "usage_org_meter" ON "billing"."usage_events" USING btree ("organization_id","meter","occurred_at");--> statement-breakpoint
CREATE INDEX "connections_org_target" ON "integrations"."connections" USING btree ("organization_id","target_type","target_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "connections_external" ON "integrations"."connections" USING btree ("provider_id","external_id","target_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_external" ON "integrations"."webhook_events" USING btree ("provider_id","external_id");--> statement-breakpoint
CREATE INDEX "bases_org" ON "knowledge"."bases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chunks_document" ON "knowledge"."chunks" USING btree ("document_id","ordinal");--> statement-breakpoint
CREATE INDEX "chunks_base" ON "knowledge"."chunks" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "chunks_tsv" ON "knowledge"."chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "documents_base" ON "knowledge"."documents" USING btree ("base_id","created_at");--> statement-breakpoint
CREATE INDEX "partner_domains_org" ON "partners"."domains" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_requests_pending" ON "partners"."requests" USING btree ("partner_id","client_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "partner_requests_client" ON "partners"."requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "activity_org_time" ON "core"."activity" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_pending" ON "core"."outbox" USING btree ("available_at") WHERE processed_at is null;--> statement-breakpoint
-- Nearest-neighbour indexes for the common embedding sizes. The column is untyped `vector` (one table for every
-- model), so each index casts to its size and applies when a query casts the same way and filters on dimensions:
-- (embedding::vector(1536)) <=> $1 ... where dimensions = 1536. Other sizes are searched exactly.
CREATE INDEX "chunks_hnsw_1536" ON "knowledge"."chunks" USING hnsw (("embedding"::vector(1536)) vector_cosine_ops) WHERE "dimensions" = 1536;--> statement-breakpoint
CREATE INDEX "chunks_hnsw_768" ON "knowledge"."chunks" USING hnsw (("embedding"::vector(768)) vector_cosine_ops) WHERE "dimensions" = 768;
