# Privacy: erasure

A player's data is erased by one path, `erase_in_transaction`
(`crates/puzzled-server/src/capabilities/preferences/adapters/account_deletion.rs`).
Two callers use it: the player's own `DeleteAccountData`, and the platform's
user-deletion fan-out below. `USER_KEYED_COLUMNS` lists every (table, column)
that holds a player id and `KEPT_TABLES` lists the tables whose rows stay and
why. A test reads the Atlas migrations and fails when a new player-keyed
column has no decision, and when a kept table has no reason.

## Platform erasure handler

When a Sylphx Auth user is deleted, Auth announces `auth.user.deletion_requested`
(`org_id`, `project_id`, `env_id`, `user_id`, `request_id`, `respond_by`) to
the handler declared in `sylphx.toml` (`[privacy] erasure_handler`), which is
`POST /webhooks/sylphx/erasure` on the api.

1. **Verify.** A Standard Webhooks signature (`webhook-id`,
   `webhook-timestamp`, `webhook-signature`; HMAC-SHA256 over
   `id.timestamp.body`) inside a five minute tolerance. Unsigned or wrongly
   signed: `401`. A `project_id` that is not `SYLPHX_AUTH_ORGANIZATION_ID` (or
   an `env_id` other than `SYLPHX_AUTH_ENVIRONMENT_ID`, when set): `403`. Both
   touch nothing.
2. **Resolve.** `user_id` maps to players through `auth_subjects`, in every
   subject form, plus the player an old-form `principal-<uuid>` names.
3. **Erase once.** Erasure and the `erasure_requests` row (keyed by
   `request_id`) commit in one transaction. A redelivery, which Auth sends
   every 24 hours until evidence arrives, erases nothing and answers the stored
   evidence.
4. **Report.** `POST /v1/privacy-requests/{request_id}/evidence` with the
   environment secret key (scope `auth:privacy:evidence`): `handler`,
   `stores` (per table `deleted`, `anonymised`, `kept` with a reason and
   count) and `completed_at`. Failure is retried three times, then the
   delivery answers `502`; the next re-announcement re-posts the same stored
   evidence. Auth's request stays failed until Puzzled has reported.

Kept: `billing_ledger` and `billing_subscriptions` rows stay for UK tax
records (six years) with the player id cleared; they are reported as
`anonymised` and `kept`. Unlike a player's own delete, this path does not wait
for a subscription to be cancelled and does not file a second Auth request.

**Status.** The handler is built and tested against a fake delivery and a fake
evidence endpoint. Wire-up waits on cloud#11120 (live 2026-10-12). Still to be
confirmed there: the webhook secret's env name (read in one place,
`erasure_delivery.rs`, currently `SYLPHX_PRIVACY_WEBHOOK_SECRET`), the exact
event body envelope (`{"type","data"}` assumed) and whether the environment id
is checked. The handler answers `503` until the secret is set.
