-- Add locale column to user_preferences for i18n user preference
-- Users can set their preferred locale (e.g., 'en-US', 'zh-HK', 'zh-TW', 'zh-CN', 'en-GB')
-- Defaults to 'en-US' (American English)
ALTER TABLE "user_preferences" ADD COLUMN "locale" text DEFAULT 'en-US';
