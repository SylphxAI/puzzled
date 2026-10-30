# Retained checkout verification

The one-shot `verify-unpaid-checkout` Job runs `/app/checkout-journey.mjs`
from the normal web image. Observability supplies its exact published image
digest, disables retries, forbids overlap and sets an absolute slot deadline
of at most 60 seconds. This repository does not schedule the check.

The check reads public pricing, the current nonempty synced Money catalogue,
the exact connected Stripe merchant and an owned registered synthetic buyer.
It uses `BillingService/CreateCheckoutAttempt`, the ordinary product checkout
with a required request identity and the existing purchase delegation guard.
An older replica does not implement that method and refuses before creating a
session. Existing clients continue to use `CreateCheckout`.

Before the first Money request the API commits its request body and chosen
Money resource ID. Only the transaction's successful inserter submits it.
Later calls read that resource. A lost response or a crash stays pending until
an authoritative read resolves it; neither time passing nor a `404` permits
another POST. A crash before submission can therefore remain UNKNOWN and
requires investigation. The checker derives a stable request key from its
fixture and predecessor, including when the first call never reached the API.
It replaces only an authoritatively expired, unpaid session. An open one-time
session is read back and reused.

The final production assertions require the declared one-time price, quantity,
minor-unit amount and currency, `livemode=true`, a `cs_live_` processor ID,
`state=open`, `payment_status=unpaid`, and a ready hosted payment form. The
checker contains no payment-detail entry or confirmation action.

## Fixture enrollment

Create the retained buyer through ordinary Auth self-signup and address
possession verification under Auth's configured synthetic email policy. The
`register-checkout-fixture` API-image Job then reads Auth's supported end-user
resource and verifies its nonempty `synthetic_time` and exact environment.
The Money binding must resolve to that same environment. In one transaction,
it creates the first product mapping and synthetic registry entry. An existing
product player cannot be reclassified. Repeated enrollment of the same pair
is idempotent; mismatched pairs are refused.

Enrollment needs the API's existing database/Money bindings and these private
configuration values: `PUZZLED_CHECKOUT_FIXTURE_SUBJECT`,
`PUZZLED_CHECKOUT_FIXTURE_KEY`, `PUZZLED_CHECKOUT_ENVIRONMENT`, and an
environment-scoped `PUZZLED_FIXTURE_AUTH_READ_KEY`. Run it before the first
product sign-in. Credentials and fixture identities never belong in this file.

Registered fixtures are excluded from signup receipts, audience observations,
completion/cohort rollups and `desk_report.activity_summary`. The declaration
in `ops/tenant-read-functions.json` names the exact aggregate signature for
the normal database-resource controller. Its role setup and authoritative
readback are separate deployment acceptance: a source declaration alone does
not prove the reader is provisioned. Anonymous page/share counters cannot
identify a fixture; the checker reads the product page as HTML without
executing its analytics. Money owns order/revenue observation. An unpaid
production check creates no verified charge; Test payments remain isolated
and are never production revenue evidence.

## Bundle configuration and result

Bind the product-owned session and Money read key through the supported
service/environment secret path before enabling the Job. They are not Job
arguments or plain Workflow environment overrides. The normal buyer session
must have its original User-Agent and a remaining lifetime covering the run.
The existing finite Access issuer supplies only the required scoped grants.
No keys, bindings or fixtures are provisioned by running the check.

| Variable | Meaning |
| --- | --- |
| `PUZZLED_CHECKOUT_MODE` | `prod-unpaid` or `test-payment` |
| `PUZZLED_CHECKOUT_BASE_URL` | Exact HTTPS product origin |
| `PUZZLED_CHECKOUT_ENVIRONMENT` | Exact Money environment resource |
| `PUZZLED_CHECKOUT_MERCHANT_ACCOUNT` | Expected Stripe `acct_` identifier |
| `PUZZLED_CHECKOUT_MONEY_READ_KEY` | Private scoped Money read credential |
| `PUZZLED_CHECKOUT_FIXTURE_SESSION` | Private ordinary buyer session |
| `PUZZLED_CHECKOUT_FIXTURE_USER_AGENT` | Original session-bound User-Agent |
| `PUZZLED_CHECKOUT_FIXTURE_KEY` | Retained registry tag |
| `PUZZLED_CHECKOUT_IMMEDIATE_SUPPLY_CONSENT` | Explicit `true` for the owned buyer |
| `JOURNEY_DEADLINE_UNIX_MS` | Absolute slot deadline; process also caps itself at 55 seconds |

Only a complete production assertion sequence exits `0`. A completed semantic
assertion failure exits `42`. Configuration, transport, authorization,
deadline, pending and runtime uncertainty exit `2`; crashes or other exits
also mean UNKNOWN to the consumer. One bounded JSON diagnostic contains fixed
step names/codes/durations. It contains no buyer, credential, provider body or
bearer Checkout link. Observability consumes the complete bundle's exit, not
individual log entries as authoritative step results.

`test-payment` currently performs isolated preflight and exits UNKNOWN with
`test_acceptance_unavailable`. It does **not** claim payment, webhook, grant or
expiry verification. Those require a separate actual Stripe Test Mode receipt,
simulated methods, negative cases and later natural-expiry readback. No local
clock, shortened licence or fake processor test can supply that receipt.

Primary-source contract read on 2026-10-30 at 13:42:55–13:42:57Z:
[Stripe testing](https://docs.stripe.com/testing) permits simulated transactions
without moving funds and prohibits testing live with real payment details.
The [Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object)
defines mode and payment state. [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests)
permits pruning keys after 24 hours and requires matching parameters; this is
why the product retains its own resource identity and never treats elapsed
time as permission to repeat an ambiguous Money POST.
