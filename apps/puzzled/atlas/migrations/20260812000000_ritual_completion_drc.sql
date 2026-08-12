-- S0: ritual.completed equivalent columns on game_sessions for DRC recompute.
-- Sole instrumentation path: written only by api after server-validated finish.
-- day_key is product day key (YYYY-MM-DD in Asia/Hong_Kong).

ALTER TABLE "game_sessions" ADD COLUMN "day_key" text;
ALTER TABLE "game_sessions" ADD COLUMN "module_class" text;
ALTER TABLE "game_sessions" ADD COLUMN "is_ritual" boolean DEFAULT false NOT NULL;
ALTER TABLE "game_sessions" ADD COLUMN "finish_kind" text;

CREATE INDEX "game_sessions_drc_day_key_idx" ON "game_sessions" ("day_key", "is_ritual", "module_class");
