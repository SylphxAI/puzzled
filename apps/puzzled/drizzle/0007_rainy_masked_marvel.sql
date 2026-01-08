ALTER TABLE "webhook_events" ADD COLUMN "stripe_created_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "subscription_id" text;--> statement-breakpoint
CREATE INDEX "webhook_events_sub_created_idx" ON "webhook_events" USING btree ("subscription_id","stripe_created_at");