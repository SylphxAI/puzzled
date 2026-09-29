-- Puzzled's own billing is gone: Sylphx Money holds subscriptions, grants and
-- the ledger. Puzzled has never had a paying customer (no Stripe key was ever
-- created), so these tables are empty. This migration proves it: if ANY row
-- exists in a billing table it fails, and the whole migration rolls back with
-- nothing renamed. A row means a payment happened; those rows are a tax record
-- (UK, six years) to be exported first, so do not edit this guard away.
--
-- The tables are RENAMED, not dropped (data-loss rule). The DROP is a later,
-- separate migration after 2026-10-29, once point-in-time recovery covers the
-- point before this rename, and after an Opus migration review.
DO $$
DECLARE
	n bigint;
BEGIN
	SELECT (SELECT count(*) FROM "billing_customers")
	     + (SELECT count(*) FROM "billing_subscriptions")
	     + (SELECT count(*) FROM "billing_ledger")
	INTO n;
	IF n > 0 THEN
		RAISE EXCEPTION 'billing tables hold % row(s): export them before retiring', n;
	END IF;
END
$$;

ALTER TABLE "billing_ledger" RENAME TO "billing_ledger__retired_20260929";
ALTER TABLE "billing_subscriptions" RENAME TO "billing_subscriptions__retired_20260929";
ALTER TABLE "billing_customers" RENAME TO "billing_customers__retired_20260929";
