-- Schema only. First-party funnel counter: anonymous rows (no user id, no IP,
-- no cookie). Safe to drop on rollback; nothing else reads it.
CREATE TABLE "funnel_events" (
    "id" uuid PRIMARY KEY DEFAULT uuidv7(),
    "occurred_at" timestamptz NOT NULL DEFAULT now(),
    "event" text NOT NULL CHECK ("event" IN ('landing', 'game_start', 'signup', 'web_vitals')),
    "path" text,
    "game_slug" text,
    "metric" text,
    "value" double precision,
    "rating" text
);
CREATE INDEX "funnel_events_event_time_idx" ON "funnel_events" ("event", "occurred_at");

-- Separate idempotency receipt; event rows remain anonymous. Deleted on erasure.
CREATE TABLE "funnel_signup_receipts" (
    "user_id" uuid PRIMARY KEY
);
