-- The next application release stops using former billing rows to classify
-- historic account ids. Refuse that rollout if any such records still exist;
-- they must first be reconciled with Money and retained under its policy.
-- Do not drop these tables yet: the still-serving release queries them during
-- guest bootstrap until this release has finished rolling out.
DO $$
BEGIN
    LOCK TABLE "billing_customers", "billing_subscriptions", "billing_ledger" IN ACCESS EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM "billing_customers")
       OR EXISTS (SELECT 1 FROM "billing_subscriptions")
       OR EXISTS (SELECT 1 FROM "billing_ledger") THEN
        RAISE EXCEPTION 'legacy billing records remain; reconcile subscriptions and account identity before rollout';
    END IF;
END
$$;
