CREATE TABLE "core"."domains" (
	"host" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."partner_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"client_id" text NOT NULL,
	"status" text NOT NULL,
	"requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "core"."domains" ADD CONSTRAINT "domains_partner_id_organization_id_fk" FOREIGN KEY ("partner_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."partner_requests" ADD CONSTRAINT "partner_requests_partner_id_organization_id_fk" FOREIGN KEY ("partner_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."partner_requests" ADD CONSTRAINT "partner_requests_client_id_organization_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_requests_pending" ON "core"."partner_requests" USING btree ("partner_id","client_id") WHERE status = 'pending';