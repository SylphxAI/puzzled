# Operations

How the api asks for help. Ordinary errors go to Sylphx Observability
([observability.md](observability.md)); a **page** is the louder signal that
on-call has to act now.

## Pages

A page is one log line from the api process carrying `event = "<name>"` and
`severity = "page"`; whatever reads the api log stream routes it to on-call.
A page fires once per incident — on the failure that crosses the threshold,
never on a single transient error — and the matching `<event>_recovered` line
at `severity = "info"` closes it. Everything else in the stream stays at normal
severity.

The helper (`FailureStreak`), the event names and each threshold live in
[`crates/puzzled-server/src/shared/pages.rs`](../crates/puzzled-server/src/shared/pages.rs):
the event name is the first argument of the static, the threshold the second.
Nothing here restates a threshold.

| Event | When it fires | First response |
| --- | --- | --- |
| `puzzled_daily_generation_failed` | A daily-puzzle fill run does not keep the buffer filled: a puzzle failed to generate and store, or fewer days than the pipeline's own alert floor are stored ahead. Some game can have no puzzle for a day. | Read the api log around the page (`daily puzzle fill ran`, `daily puzzle generation failed`). A failing generator: reproduce that game and day against `puzzled-core`, then let the next fill backfill it. A database error: check Postgres; the hourly Compute tick retries the fill, and an api restart fills at start-up. |
| `puzzled_signin_unavailable` | Sign-in checks repeatedly cannot get an answer, on either path behind one shared streak (so one outage is one page): an opaque `identity_org_session_` session cannot be checked because Auth is unreachable, times out or answers 5xx, or a platform JWT cannot be verified because the JWKS is unavailable (Platform unreachable, a 5xx, or a key set that will not parse). Signed-in requests are then refused or answer 503. A refusal never counts: an Auth 401/403 or a bad, expired or wrong-audience token means the service is up. | Check Auth first: `GET {SYLPHX_AUTH_URL}/v1/sessions/current` from the api (`SYLPHX_AUTH_URL`, default `https://api.sylphx.com`); the log line `auth session check failed` shows transport errors. Then fetch `https://api.sylphx.com/.well-known/jwks.json` and check `PLATFORM_JWKS_URL`. Platform itself out: the last good key set keeps serving verification, and the refresher recovers on its own. A wrong URL or a key set with no RSA keys: fix the env and restart. Detail says which: `unreachable`, `http_5xx` or `jwks_unavailable`. |
| `puzzled_entitlement_check_failed` | Entitlement reads error repeatedly — the Postgres subscription read or the Stripe read-back behind it. The play gate fails closed meanwhile, so a signed-in paying account is refused paid play and the web shows nothing locked. Ordinary access reads (an okay subscription, an account with none) never count. | Read the api log around the page (`entitlement read failed; refusing paid play`, `stale subscription read-back failed`, `billing failed`). Postgres first (`desk-pg-ro`, pool saturation, the `subscriptions` and family tables), then the Stripe read-back (API reachability and the Stripe key). Refusing to open paid play while the answer is unknown is intended; the recovery line follows the first read that answers. |

Each event is counted in memory per api process, so a restart clears the
streak and the next failure pages again.
