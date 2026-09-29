-- Puzzled's own billing is gone: Sylphx Money holds subscriptions, grants and
-- the ledger. Puzzled has never had a paying customer (no Stripe key was ever
-- created), so these tables are empty. This migration proves it: if ANY row
-- exists in a billing table it fails, and the whole migration rolls back with
-- nothing dropped. A row means a payment happened; those rows are a tax record
-- (UK, six years) to be exported before any drop, so do not edit this guard away.
DO $$
DECLARE
	n bigint;
BEGIN
	SELECT (SELECT count(*) FROM "billing_customers")
	     + (SELECT count(*) FROM "billing_subscriptions")
	     + (SELECT count(*) FROM "billing_ledger")
	INTO n;
	IF n > 0 THEN
		RAISE EXCEPTION 'billing tables hold % row(s): export them before dropping', n;
	END IF;
END
$$;

DROP TABLE "billing_ledger";
DROP TABLE "billing_subscriptions";
DROP TABLE "billing_customers";
