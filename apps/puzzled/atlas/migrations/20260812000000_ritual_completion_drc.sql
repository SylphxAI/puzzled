-- S0: ritual.completed equivalent columns on game_sessions for DRC recompute.
-- Sole instrumentation path: written only by api after server-validated finish.
-- day_key is product day key (YYYY-MM-DD in Asia/Hong_Kong).
--
-- Idempotent: prod may already have these columns from a pre-atlas-gate apply
-- path (web release_command / partial apply) while atlas_schema_revisions still
-- sat at baseline 20260222000000. Non-IF-NOT-EXISTS ADD COLUMN made the project
-- migration Job fail closed and held dens auto_deploy on migration_pending,
-- so 20260812010000 never applied.

ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "day_key" text;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "module_class" text;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "is_ritual" boolean DEFAULT false NOT NULL;
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "finish_kind" text;

CREATE INDEX IF NOT EXISTS "game_sessions_drc_day_key_idx"
  ON "game_sessions" ("day_key", "is_ritual", "module_class");
