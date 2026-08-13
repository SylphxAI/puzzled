-- Canonical module slugs: queens → crowns, tango → duo (CUTOVER.md).
-- Unique ritual index is (user_id, game_slug, day_key). Collapse alias+canonical
-- pairs by keeping the earlier qualifying finish.

WITH queens_dup AS (
  SELECT a.id
  FROM game_sessions a
  INNER JOIN game_sessions b
    ON a.user_id = b.user_id
   AND a.day_key = b.day_key
   AND a.is_ritual = true
   AND b.is_ritual = true
   AND a.game_slug = 'queens'
   AND b.game_slug = 'crowns'
   AND a.day_key IS NOT NULL
)
UPDATE game_sessions AS gs
SET is_ritual = false,
    day_key = NULL,
    module_class = NULL,
    finish_kind = NULL
FROM queens_dup AS d
WHERE gs.id = d.id;

UPDATE game_sessions SET game_slug = 'crowns' WHERE game_slug = 'queens';

WITH tango_dup AS (
  SELECT a.id
  FROM game_sessions a
  INNER JOIN game_sessions b
    ON a.user_id = b.user_id
   AND a.day_key = b.day_key
   AND a.is_ritual = true
   AND b.is_ritual = true
   AND a.game_slug = 'tango'
   AND b.game_slug = 'duo'
   AND a.day_key IS NOT NULL
)
UPDATE game_sessions AS gs
SET is_ritual = false,
    day_key = NULL,
    module_class = NULL,
    finish_kind = NULL
FROM tango_dup AS d
WHERE gs.id = d.id;

UPDATE game_sessions SET game_slug = 'duo' WHERE game_slug = 'tango';

UPDATE daily_puzzles SET game_slug = 'crowns' WHERE game_slug = 'queens';
UPDATE daily_puzzles SET game_slug = 'duo' WHERE game_slug = 'tango';
