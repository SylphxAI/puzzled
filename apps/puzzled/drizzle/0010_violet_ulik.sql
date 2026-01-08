CREATE TYPE "public"."win_back_email_type" AS ENUM('day7', 'day14', 'day30');--> statement-breakpoint
CREATE TABLE "win_back_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_type" "win_back_email_type" NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"promotion_code" text,
	"user_returned" boolean DEFAULT false,
	"returned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_end" timestamp;--> statement-breakpoint
ALTER TABLE "win_back_emails" ADD CONSTRAINT "win_back_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "win_back_emails_user_idx" ON "win_back_emails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "win_back_emails_type_idx" ON "win_back_emails" USING btree ("email_type");--> statement-breakpoint
CREATE INDEX "win_back_emails_sent_at_idx" ON "win_back_emails" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "win_back_emails_user_type_idx" ON "win_back_emails" USING btree ("user_id","email_type");