WITH qualified AS MATERIALIZED (
  SELECT user_id, day_key, completed_at FROM game_sessions
  WHERE is_ritual = true AND module_class = 'puzzle_ritual' AND status IN ('won', 'lost')
), daily AS MATERIALIZED (
  SELECT DISTINCT user_id, day_key FROM qualified
), firsts AS MATERIALIZED (
  SELECT user_id, min(day_key) AS first_day, min(completed_at) AS first_at FROM qualified GROUP BY user_id
), days AS (
  SELECT to_char(d, 'YYYY-MM-DD') AS day_key FROM generate_series($1::date, $2::date, interval '1 day') d
)
SELECT days.day_key,
  (SELECT count(*) FROM daily q WHERE q.day_key = days.day_key) AS daily_puzzle_completers,
  (SELECT count(*) FROM daily q WHERE q.day_key = days.day_key
     AND EXISTS (SELECT 1 FROM auth_subjects a WHERE a.user_id = q.user_id)) AS signed_in_completers,
  (SELECT count(DISTINCT user_id) FROM game_sessions g WHERE g.day_key = days.day_key
     AND g.is_ritual = true AND g.module_class = 'entertainment_oracle' AND g.status IN ('won','lost')) AS daily_entertainment_completers,
  (SELECT count(*) FROM (SELECT user_id FROM daily q
     WHERE q.day_key BETWEEN to_char(days.day_key::date - 6, 'YYYY-MM-DD') AND days.day_key
     GROUP BY user_id HAVING count(*) >= 4) regulars) AS weekly_ritualists,
  (SELECT count(*) FROM firsts f WHERE f.first_day = to_char(days.day_key::date - 7, 'YYYY-MM-DD')) AS d7_cohort,
  (SELECT count(*) FROM firsts f JOIN daily q ON q.user_id = f.user_id AND q.day_key = days.day_key
     WHERE f.first_day = to_char(days.day_key::date - 7, 'YYYY-MM-DD')) AS d7_returned,
  (SELECT count(*) FROM funnel_events e WHERE e.event = 'share_landing'
     AND e.occurred_at >= days.day_key::date::timestamp AT TIME ZONE 'Asia/Hong_Kong'
     AND e.occurred_at < (days.day_key::date + 1)::timestamp AT TIME ZONE 'Asia/Hong_Kong') AS share_landings,
  (SELECT count(*) FROM firsts f WHERE f.first_day = days.day_key AND EXISTS (
     SELECT 1 FROM share_landings l
     WHERE l.user_id = f.user_id AND l.day_key BETWEEN to_char(days.day_key::date - 6, 'YYYY-MM-DD') AND days.day_key
       AND f.first_at >= l.landed_at AT TIME ZONE 'UTC')) AS share_landing_completers,
  COALESCE((SELECT count FROM metric_counters WHERE day_key = days.day_key AND event = 'share'), 0) AS shares,
  COALESCE((SELECT count FROM metric_counters WHERE day_key = days.day_key AND event = 'free_finish_ok'), 0) AS free_finish_ok,
  COALESCE((SELECT count FROM metric_counters WHERE day_key = days.day_key AND event = 'free_finish_failed'), 0) AS free_finish_failed,
  (SELECT count(*) FROM metric_audiences a WHERE a.day_key = days.day_key AND a.paid) AS paid_active,
  (SELECT count(*) FROM metric_audiences a JOIN daily q USING (user_id, day_key) WHERE a.day_key = days.day_key AND a.paid) AS paid_completers,
  (SELECT count(*) FROM metric_audiences a WHERE a.day_key = days.day_key AND NOT a.paid) AS free_active,
  (SELECT count(*) FROM metric_audiences a JOIN daily q USING (user_id, day_key) WHERE a.day_key = days.day_key AND NOT a.paid) AS free_completers
FROM days ORDER BY days.day_key
