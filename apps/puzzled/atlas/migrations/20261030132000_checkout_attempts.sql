-- A buyer's retained checkout request. An ambiguous processor call remains
-- pending; reading the request never submits another checkout.
CREATE TABLE "checkout_attempts" (
    "user_id" uuid NOT NULL,
    request_id uuid NOT NULL,
    money_session_id text NOT NULL UNIQUE,
    request jsonb NOT NULL,
    state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready', 'refused')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, request_id)
);
CREATE INDEX checkout_attempts_latest ON checkout_attempts (user_id, created_at DESC);

-- Registered only after Auth's supported end-user read confirms a
-- born-synthetic subject. Registration precedes the first product session.
CREATE TABLE "synthetic_fixtures" (
    "user_id" uuid PRIMARY KEY,
    fixture_key text NOT NULL UNIQUE,
    auth_subject text NOT NULL UNIQUE,
    synthetic_time timestamptz NOT NULL,
    registered_at timestamptz NOT NULL DEFAULT now()
);

-- Canonical activity observation. Grants are applied by the database resource
-- controller from the explicit declaration, never by a product migration.
CREATE SCHEMA IF NOT EXISTS desk_report;
CREATE OR REPLACE FUNCTION desk_report.activity_summary(as_of timestamptz DEFAULT now())
RETURNS TABLE(as_of timestamptz, registered_users bigint, dau bigint, wau bigint, mau bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
SET statement_timeout = '5s'
AS $report$
WITH activity AS (
    SELECT g.user_id, g.started_at AT TIME ZONE 'UTC' AS occurred_at FROM public.game_sessions g
    UNION ALL
    SELECT g.user_id, g.completed_at AT TIME ZONE 'UTC' FROM public.game_sessions g WHERE g.completed_at IS NOT NULL
), visible AS (
    SELECT a.* FROM activity a
    WHERE a.occurred_at > $1 - interval '30 days' AND a.occurred_at <= $1
      AND NOT EXISTS (SELECT 1 FROM public.synthetic_fixtures f WHERE f.user_id=a.user_id)
)
SELECT $1,
    (SELECT count(DISTINCT a.user_id) FROM public.auth_subjects a
     WHERE a.created_at AT TIME ZONE 'UTC' <= $1
       AND NOT EXISTS (SELECT 1 FROM public.synthetic_fixtures f WHERE f.user_id=a.user_id)),
    count(DISTINCT user_id) FILTER (WHERE occurred_at > $1 - interval '24 hours'),
    count(DISTINCT user_id) FILTER (WHERE occurred_at > $1 - interval '7 days'),
    count(DISTINCT user_id)
FROM visible
WHERE $1 IS NOT NULL AND isfinite($1);
$report$;
COMMENT ON FUNCTION desk_report.activity_summary(timestamptz) IS
'Aggregate product activity from game start/finish timestamps, trailing 24 hours/7 days/30 days. Registered users are distinct Auth-mapped players. Registered born-synthetic fixtures are excluded from every count. No identities are returned.';
