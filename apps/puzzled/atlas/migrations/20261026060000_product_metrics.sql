-- Aggregate reports contain no player ids. Source receipts are short lived,
-- erased with the player, and never used to assert a finish.
CREATE TABLE "metric_days" (
  "id" uuid PRIMARY KEY NOT NULL,
  "day_key" text UNIQUE NOT NULL,
  "report" jsonb NOT NULL,
  "generated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "metric_counters" (
  "day_key" text NOT NULL,
  "event" text NOT NULL CHECK (event IN ('share', 'free_finish_ok', 'free_finish_failed')),
  "count" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day_key, event)
);
CREATE TABLE "share_landings" (
  "user_id" uuid NOT NULL,
  "share_id" uuid NOT NULL CONSTRAINT "share_landings_share_id_result_shares_id_fk" REFERENCES result_shares(id) ON DELETE CASCADE,
  "day_key" text NOT NULL,
  "landed_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, share_id, day_key)
);
CREATE INDEX share_landings_day_idx ON share_landings(day_key);
CREATE TABLE "metric_audiences" (
  "user_id" uuid NOT NULL,
  "day_key" text NOT NULL,
  "paid" boolean NOT NULL,
  PRIMARY KEY (user_id, day_key)
);
CREATE TABLE "metric_alert_outbox" (
  "day_key" text NOT NULL,
  "signal" text NOT NULL,
  "emitted_at" timestamptz,
  PRIMARY KEY (day_key, signal)
);
CREATE INDEX game_sessions_metric_cohort_idx ON game_sessions(user_id, day_key)
  WHERE is_ritual = true AND module_class = 'puzzle_ritual' AND status IN ('won', 'lost');

-- A visible landing count remains anonymous, even when attribution is declined.
ALTER TABLE funnel_events DROP CONSTRAINT funnel_events_event_check;
ALTER TABLE funnel_events ADD CONSTRAINT funnel_events_event_check
  CHECK (event IN ('landing', 'game_start', 'signup', 'web_vitals', 'share_landing'));
