-- Player-chosen games use the same Asia/Hong_Kong civil day as daily puzzles.
-- Writers serialize on the stable player lock, including admission and erasure.
CREATE TABLE "daily_free_picks" (
    "user_id" uuid NOT NULL,
    day_key date NOT NULL,
    game_slug text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("user_id", day_key, game_slug)
);
