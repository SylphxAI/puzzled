# Money checkout cutover: rollout and evidence

Do not confuse a public price list, hosted payment page, or a local fake-Money
test with verified payment, webhook and entitlement delivery. Money is the sole
billing authority; no browser return parameter or manual entitlement grant
proves a sale.

## Ordered rollout

1. Deploy checkout-return refresh and remove the former billing-table reader
   from guest identity classification. The pre-rollout migration **refuses any
   legacy billing row**, without deleting or altering records. If it refuses,
   stop: reconcile account identity and subscriptions with Money, and retain
   financial records under the seller's policy. Do not empty the tables just
   to make the guard pass.
2. Wait for the new API revision to be serving and the previous instances to
   finish draining. Run the existing live verifier against that revision.
3. Keep two separate checkout receipts. In production, use an owned registered
   synthetic buyer through the ordinary product checkout, require current synced
   prices and an unpaid `cs_live_` session, then stop before payment details or
   confirmation. Complete payment only in the isolated Stripe Test environment
   (`livemode=false`, `cs_test_`) with simulated methods. Delegated sessions
   cannot purchase. Confirm Test payment, webhook, `source=plus` and
   `entitled=true` through Money and the product. A reverse trial or family
   membership is not purchase evidence. Follow the
   [retained checkout contract](checkout-journey.md) for fixture custody,
   readback, negative cases and natural expiry.
4. With that same Test account, open a non-featured game and an archive day. Both
   must be playable immediately. Check an existing subscriber still has access
   and that an unpaid account remains blocked from paid play while the featured
   daily puzzle stays free. A forged success URL must not unlock Plus.
5. Only then apply the contract migration to remove the empty former billing
   tables and their schema definitions. Repeat the empty-table guard atomically
   with the drop, without `CASCADE`. Keep family membership, checkout consent,
   reverse-trial history, and all player results. This must be a later rollout:
   migrations run **before** writers roll, and the previous API still queries
   those tables in its guest-account guard.

## Separate production and Test receipts

Record UTC timestamps, serving API revision, ordinary checkout/subscription
receipt references and the unpaid session's mode, amount, currency and state.
Record actual Stripe Test payment, webhook, grant, paid-game/archive, negative
cases and natural-expiry readback separately. Preserve the existing-subscriber
continuity and unpaid/free-floor checks. Keep account identifiers, payment
details and private receipts out of public pull requests. A Test subscription
cancellation is a separate account action, never a payment-record deletion.

## Checkout convergence

The checkout return already sends `GetSubscriptionRequest.refresh=true`. The
API now forgets only that authenticated account's cached Money answers, then
checks Money again. It never changes a grant. The return page polls for up to
30 seconds while confirmation is pending and displays success only for an own
confirmed subscription. Refreshing again is safe if processor confirmation
arrives later. Normal reads retain their bounded caches; free play never reads
billing.
