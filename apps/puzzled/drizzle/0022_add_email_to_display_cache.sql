-- Add email column to user_display_cache for CAN-SPAM compliant win-back emails
-- Email is stored when user opts into marketing (via notificationPreferences.emailMarketing)
ALTER TABLE "user_display_cache" ADD COLUMN "email" text;
