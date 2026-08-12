-- One free-daily ritual finish per (user, game module, product day).
--
-- Complements game_sessions_user_puzzle_idx (user_id, puzzle_id), which does
-- not fire when puzzle_id is NULL (deterministic sudoku / unserved store).
-- Partial unique index enforces the product floor under concurrent SubmitGuess.
--
-- Pre-clean: dogfood residual could insert multiple is_ritual rows for the same
-- (user, game, day) when already_played was pid-gated. Demote extras so the
-- unique index can apply; DRC (COUNT DISTINCT user_id) is unchanged.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, game_slug, day_key
           ORDER BY completed_at ASC NULLS LAST, started_at ASC, id ASC
         ) AS rn
  FROM game_sessions
  WHERE is_ritual = true AND day_key IS NOT NULL
)
UPDATE game_sessions AS gs
SET is_ritual = false,
    day_key = NULL,
    module_class = NULL,
    finish_kind = NULL
FROM ranked AS r
WHERE gs.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX "game_sessions_ritual_user_game_day_uidx"
  ON "game_sessions" ("user_id", "game_slug", "day_key")
  WHERE "is_ritual" = true AND "day_key" IS NOT NULL;
