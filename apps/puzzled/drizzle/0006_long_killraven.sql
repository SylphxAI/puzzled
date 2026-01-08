CREATE TYPE "public"."dlq_status" AS ENUM('pending', 'retrying', 'resolved', 'failed');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'super_admin';--> statement-breakpoint
CREATE TABLE "dead_letter_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_name" text NOT NULL,
	"workflow_run_id" text,
	"payload" jsonb,
	"error" text NOT NULL,
	"error_stack" text,
	"status" "dlq_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"last_retry_at" timestamp,
	"resolved_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dlq_workflow_name_idx" ON "dead_letter_queue" USING btree ("workflow_name");--> statement-breakpoint
CREATE INDEX "dlq_status_idx" ON "dead_letter_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dlq_created_at_idx" ON "dead_letter_queue" USING btree ("created_at");