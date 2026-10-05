-- Schema only. First-party funnel counter: anonymous rows (no user id, no IP,
-- no cookie). Safe to drop on rollback; nothing else reads it.
CREATE TABLE "funnel_events" (
    "id" bigserial PRIMARY KEY,
    "occurred_at" timestamptz NOT NULL DEFAULT now(),
    "event" text NOT NULL CHECK ("event" IN ('landing', 'game_start', 'signup', 'web_vitals')),
    "path" text,
    "game_slug" text,
    "metric" text,
    "value" double precision,
    "rating" text
);
CREATE INDEX "funnel_events_event_time_idx" ON "funnel_events" ("event", "occurred_at");
