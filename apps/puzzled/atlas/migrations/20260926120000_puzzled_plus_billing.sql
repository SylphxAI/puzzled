-- Puzzled Plus. Stripe is the payment processor; these tables own the
-- entitlement and the money ledger (issue #235).
CREATE TABLE "billing_customers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);

CREATE TABLE "billing_subscriptions" (
	"stripe_subscription_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"stripe_customer_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"started_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "billing_subscriptions_user_id_idx" ON "billing_subscriptions" USING btree ("user_id");

-- Append-only: a refund is a new negative row, never an edit.
CREATE TABLE "billing_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_ledger_source_id_unique" UNIQUE("source_id")
);
CREATE INDEX "billing_ledger_user_id_idx" ON "billing_ledger" USING btree ("user_id");

CREATE TABLE "family_groups" (
	"owner_user_id" uuid PRIMARY KEY NOT NULL,
	"invite_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_groups_invite_code_unique" UNIQUE("invite_code")
);

CREATE TABLE "family_members" (
	"member_user_id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "family_members_owner_user_id_idx" ON "family_members" USING btree ("owner_user_id");
