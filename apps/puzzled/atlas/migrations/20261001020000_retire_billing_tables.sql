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
	RAISE NOTICE 'retire_billing_tables: guard passed, billing_customers + billing_subscriptions + billing_ledger hold % rows; renaming to *__retired_20260929', n;
END
$$;

ALTER TABLE "billing_ledger" RENAME TO "billing_ledger__retired_20260929";
ALTER TABLE "billing_subscriptions" RENAME TO "billing_subscriptions__retired_20260929";
ALTER TABLE "billing_customers" RENAME TO "billing_customers__retired_20260929";

-- Constraint and index names follow the tables' new names, so the Drizzle
-- definitions of the retired tables (schema.ts) match without special cases.
ALTER INDEX "billing_customers_pkey" RENAME TO "billing_customers__retired_20260929_pkey";
ALTER TABLE "billing_customers__retired_20260929"
	RENAME CONSTRAINT "billing_customers_stripe_customer_id_unique"
	TO "billing_customers__retired_20260929_stripe_customer_id_unique";

ALTER INDEX "billing_subscriptions_pkey" RENAME TO "billing_subscriptions__retired_20260929_pkey";
ALTER INDEX "billing_subscriptions_user_id_idx" RENAME TO "billing_subscriptions__retired_20260929_user_id_idx";

ALTER INDEX "billing_ledger_pkey" RENAME TO "billing_ledger__retired_20260929_pkey";
ALTER TABLE "billing_ledger__retired_20260929"
	RENAME CONSTRAINT "billing_ledger_source_id_unique"
	TO "billing_ledger__retired_20260929_source_id_unique";
ALTER INDEX "billing_ledger_user_id_idx" RENAME TO "billing_ledger__retired_20260929_user_id_idx";

-- Reverse:
-- ALTER INDEX "billing_ledger__retired_20260929_user_id_idx" RENAME TO "billing_ledger_user_id_idx";
-- ALTER TABLE "billing_ledger__retired_20260929" RENAME CONSTRAINT "billing_ledger__retired_20260929_source_id_unique" TO "billing_ledger_source_id_unique";
-- ALTER INDEX "billing_ledger__retired_20260929_pkey" RENAME TO "billing_ledger_pkey";
-- ALTER INDEX "billing_subscriptions__retired_20260929_user_id_idx" RENAME TO "billing_subscriptions_user_id_idx";
-- ALTER INDEX "billing_subscriptions__retired_20260929_pkey" RENAME TO "billing_subscriptions_pkey";
-- ALTER TABLE "billing_customers__retired_20260929" RENAME CONSTRAINT "billing_customers__retired_20260929_stripe_customer_id_unique" TO "billing_customers_stripe_customer_id_unique";
-- ALTER INDEX "billing_customers__retired_20260929_pkey" RENAME TO "billing_customers_pkey";
-- ALTER TABLE "billing_customers__retired_20260929" RENAME TO "billing_customers";
-- ALTER TABLE "billing_subscriptions__retired_20260929" RENAME TO "billing_subscriptions";
-- ALTER TABLE "billing_ledger__retired_20260929" RENAME TO "billing_ledger";
