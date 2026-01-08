CREATE TYPE "public"."security_alert_type" AS ENUM('new_login', 'password_changed', '2fa_enabled', '2fa_disabled', 'new_device', 'suspicious_login', 'oauth_connected', 'oauth_disconnected', 'session_revoked');--> statement-breakpoint
CREATE TYPE "public"."verification_code_type" AS ENUM('reauth', 'email_change', 'delete_account', 'enable_2fa');--> statement-breakpoint
CREATE TABLE "email_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"new_email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_change_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "security_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "security_alert_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"type" "verification_code_type" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_format" text DEFAULT 'relative';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "leaderboard_visible" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_change_requests" ADD CONSTRAINT "email_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_change_requests_user_idx" ON "email_change_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_change_requests_token_idx" ON "email_change_requests" USING btree ("token");--> statement-breakpoint
CREATE INDEX "email_change_requests_expires_at_idx" ON "email_change_requests" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "billing_transactions" ADD COLUMN "hosted_invoice_url" text;--> statement-breakpoint
CREATE INDEX "security_alerts_user_idx" ON "security_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_alerts_user_read_idx" ON "security_alerts" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "security_alerts_created_at_idx" ON "security_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verification_codes_user_idx" ON "verification_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_codes_expires_idx" ON "verification_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verification_codes_user_type_idx" ON "verification_codes" USING btree ("user_id","type");