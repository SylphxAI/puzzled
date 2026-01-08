CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('charge', 'refund', 'dispute', 'dispute_reversal');--> statement-breakpoint
CREATE TABLE "billing_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_invoice_id" text,
	"stripe_charge_id" text,
	"stripe_payment_intent_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" NOT NULL,
	"description" text,
	"metadata" jsonb,
	"stripe_created_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_transactions_user_idx" ON "billing_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_transactions_customer_idx" ON "billing_transactions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_transactions_invoice_idx" ON "billing_transactions" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "billing_transactions_charge_idx" ON "billing_transactions" USING btree ("stripe_charge_id");--> statement-breakpoint
CREATE INDEX "billing_transactions_type_idx" ON "billing_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "billing_transactions_status_idx" ON "billing_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_transactions_created_at_idx" ON "billing_transactions" USING btree ("created_at");