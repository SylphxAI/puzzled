-- Marketing email is opt-in: new players start with it off.
-- Existing rows keep the choice they already hold.
ALTER TABLE "notification_preferences" ALTER COLUMN "email_marketing" SET DEFAULT false;
