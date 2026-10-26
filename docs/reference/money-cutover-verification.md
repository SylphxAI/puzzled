# Money checkout cutover: rollout and evidence

Do not confuse a public price list, hosted payment page, or a local fake-Money
test with a completed production purchase. Money is the sole billing authority;
no browser return parameter or manual entitlement grant proves a sale.

## Ordered rollout

1. Deploy checkout-return refresh and remove the former billing-table reader
   from guest identity classification. The pre-rollout migration **refuses any
   legacy billing row**, without deleting or altering records. If it refuses,
   stop: reconcile account identity and subscriptions with Money, and retain
   financial records under the seller's policy. Do not empty the tables just
   to make the guard pass.
2. Wait for the new API revision to be serving and the previous instances to
   finish draining. Run the existing live verifier against that revision.
3. Complete a purchase through `/pricing` and the ordinary hosted Money checkout
   with a human-owned test account and an authorized payment method. Delegated
   sessions cannot purchase; do not bypass that guard. Confirm the return page
   reads `source=plus`, `entitled=true` and `status=active` (or the actual Money
   trial status). A reverse trial or family membership is not purchase evidence.
4. With that same account, open a non-featured game and an archive day. Both
   must be playable immediately. Check an existing subscriber still has access
   and that an unpaid account remains blocked from paid play while the featured
   daily puzzle stays free. A forged success URL must not unlock Plus.
5. Only then apply the contract migration to remove the empty former billing
   tables and their schema definitions. Repeat the empty-table guard atomically
   with the drop, without `CASCADE`. Keep family membership, checkout consent,
   reverse-trial history, and all player results. This must be a later rollout:
   migrations run **before** writers roll, and the previous API still queries
   those tables in its guest-account guard.

## Production receipt

Record UTC timestamps, serving API revision, ordinary checkout/subscription
receipt references, the confirmed subscription response, paid-game and archive
results, the existing-subscriber continuity check, and the unpaid/free-floor
checks. Keep account identifiers, payment details and private receipts out of
public pull requests. Cancelling a test subscription is a separate, deliberate
account action, not a refund or payment-record deletion.

## Checkout convergence

The checkout return already sends `GetSubscriptionRequest.refresh=true`. The
API now forgets only that authenticated account's cached Money answers, then
checks Money again. It never changes a grant. The return page polls for up to
30 seconds while confirmation is pending and displays success only for an own
confirmed subscription. Refreshing again is safe if processor confirmation
arrives later. Normal reads retain their bounded caches; free play never reads
billing.
