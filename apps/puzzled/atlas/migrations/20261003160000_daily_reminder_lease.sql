-- Schema only. Keep these additive fields on rollback: drain the leased
-- Jobs executor or forward-fix it; an older executor does not honor leases.
ALTER TABLE "notification_preferences"
    ADD COLUMN "daily_reminder_claim_token" uuid,
    ADD COLUMN "daily_reminder_claim_on" date,
    ADD COLUMN "daily_reminder_lease_until" timestamptz;
