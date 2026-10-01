-- Extend #303's single erasure_requests owner into a durable owned operation.
-- Schema only: no backfill, identity mutation, deletion, or billing side effects.
-- Exact identity snapshots exist only while the operation drains; suppression
-- is a canonical UUID SHA256 handle and remains after snapshot scrubbing.
CREATE TABLE "erasure_requests" (
    "request_id" uuid PRIMARY KEY NOT NULL,
    "player_id" uuid,
    "suppression_hash" text NOT NULL,
    CONSTRAINT "erasure_requests_suppression_hash_unique" UNIQUE ("suppression_hash"),
    "organization_id" text,
    "subjects" jsonb,
    "state" text DEFAULT 'pending' NOT NULL,
    "lease_token" uuid,
    "lease_until" timestamp,
    "retry_due" timestamp DEFAULT now() NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_reason" text,
    "local_erased_at" timestamp,
    "completed_at" timestamp,
    "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "erasure_requests_state_check" CHECK ("state" IN ('pending', 'auth_pending', 'local_erased', 'completed')),
    CONSTRAINT "erasure_requests_hash_check" CHECK ("suppression_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "erasure_requests_attempts_check" CHECK ("attempts" >= 0),
    CONSTRAINT "erasure_requests_evidence_check" CHECK (jsonb_typeof("evidence") = 'object' AND NOT jsonb_path_exists("evidence", '$.* ? (@.type() != "number" || @ < 0 || @ != @.floor())')),
    CONSTRAINT "erasure_requests_reason_check" CHECK ("last_reason" IS NULL OR "last_reason" IN ('database_unavailable', 'money_unavailable', 'money_preflight_unavailable', 'checkout_unsettled', 'cancel_subscription_first', 'erasure_unconfigured', 'subject_lookup_failed', 'auth_delete_failed', 'auth_receipt_unconfirmed', 'auth_request_pending', 'auth_request_failed', 'auth_request_missing', 'product_delete_failed', 'lease_lost', 'instance_changed')),
    CONSTRAINT "erasure_requests_lease_check" CHECK (("lease_until" IS NULL) = ("lease_token" IS NULL)),
    CONSTRAINT "erasure_requests_active_check" CHECK (
        "state" = 'completed' OR ("player_id" IS NOT NULL AND "organization_id" IS NOT NULL
            AND length(btrim("organization_id")) > 0 AND "subjects" IS NOT NULL
            AND jsonb_typeof("subjects") = 'array' AND jsonb_array_length("subjects") > 0)
    ),
    CONSTRAINT "erasure_requests_local_check" CHECK (
        "state" NOT IN ('local_erased', 'completed') OR "local_erased_at" IS NOT NULL
    ),
    CONSTRAINT "erasure_requests_completed_check" CHECK (
        "state" <> 'completed' OR ("completed_at" IS NOT NULL AND "player_id" IS NULL
            AND "organization_id" IS NULL AND "subjects" IS NULL AND "lease_until" IS NULL
            AND "lease_token" IS NULL AND "last_reason" IS NULL)
    )
);
CREATE INDEX "erasure_requests_retry_idx" ON "erasure_requests" ("retry_due") WHERE "state" <> 'completed';

-- Retain the legal statement and purchase context, unlinking only identity.
ALTER TABLE "checkout_consents" ALTER COLUMN "user_id" DROP NOT NULL;

CREATE FUNCTION puzzled_erasure_player_hash(player uuid) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT encode(sha256(convert_to(player::text, 'UTF8')), 'hex')
$$;

-- The same domain-separated lock is used by admission, cleanup, and writers.
CREATE FUNCTION puzzled_erasure_lock(player uuid) RETURNS void
LANGUAGE plpgsql VOLATILE STRICT AS $$
BEGIN
    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'erasure_fence_requires_read_committed' USING ERRCODE = '55000';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('puzzled:erasure:' || player::text, 0));
END
$$;

-- Coverage follows USER_KEYED_COLUMNS, including business-content actor links.
-- OLD + NEW locks are ordered and deduplicated; no caller-controlled bypass.
-- Deleting removes data; nulling identity permits the approved unlink cleanup.
CREATE FUNCTION puzzled_erasure_write_fence() RETURNS trigger
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
    old_row jsonb;
    new_row jsonb;
    all_players uuid[] := ARRAY[]::uuid[];
    new_players uuid[] := ARRAY[]::uuid[];
    column_name text;
    player uuid;
    lock_key bigint;
BEGIN
    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'erasure_fence_requires_read_committed' USING ERRCODE = '55000';
    END IF;
    IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
    FOREACH column_name IN ARRAY TG_ARGV LOOP
        IF old_row ->> column_name IS NOT NULL THEN
            all_players := array_append(all_players, (old_row ->> column_name)::uuid);
        END IF;
        IF new_row ->> column_name IS NOT NULL THEN
            player := (new_row ->> column_name)::uuid;
            all_players := array_append(all_players, player);
            new_players := array_append(new_players, player);
        END IF;
    END LOOP;
    FOR lock_key IN SELECT DISTINCT hashtextextended('puzzled:erasure:' || p::text, 0) AS key
        FROM unnest(all_players) p ORDER BY key LOOP
        PERFORM pg_advisory_xact_lock(lock_key);
    END LOOP;
    -- READ COMMITTED takes a fresh snapshot for this check after the locks.
    IF EXISTS (
        SELECT 1 FROM erasure_requests e
        WHERE e.suppression_hash IN (
            SELECT puzzled_erasure_player_hash(p) FROM unnest(new_players) p
        )
    ) THEN
        RAISE EXCEPTION 'account_erasure_pending' USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "tryit_conversions" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "account_attribution" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "auth_subjects" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "checkout_consents" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "family_members" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('owner_user_id', 'member_user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "family_groups" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('owner_user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "announcement_dismissals" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id', 'actor_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "game_sessions" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "notification_preferences" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "push_subscriptions" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "result_shares" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "user_display_cache" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "user_freeze_data" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "streak_freeze_awards" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "streak_freeze_uses" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "user_preferences" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "win_back_emails" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('user_id');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "announcements" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('created_by');
CREATE TRIGGER erasure_write_fence BEFORE INSERT OR UPDATE OR DELETE ON "app_settings" FOR EACH ROW EXECUTE FUNCTION puzzled_erasure_write_fence('updated_by');

-- Reminder owner uses this VOLATILE helper on a materialized bounded candidate
-- page, retaining transaction locks through its UPDATE. Busy players are skipped.
CREATE FUNCTION puzzled_erasure_try_admit(player uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE STRICT AS $$
BEGIN
    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION 'erasure_fence_requires_read_committed' USING ERRCODE = '55000';
    END IF;
    IF NOT pg_try_advisory_xact_lock(hashtextextended('puzzled:erasure:' || player::text, 0)) THEN
        RETURN false;
    END IF;
    RETURN NOT EXISTS (SELECT 1 FROM erasure_requests
        WHERE suppression_hash = puzzled_erasure_player_hash(player));
END
$$;
