-- Browser identity and adoption provenance; no existing data is changed.
CREATE TABLE "guest_credentials" (
    "token_hash" text PRIMARY KEY NOT NULL,
    "user_id" uuid NOT NULL UNIQUE,
    "adopted_user_id" uuid,
    "revoked_at" timestamp,
    "revocation_reason" text,
    "provenance" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "guest_credentials_adopted_user_id_idx" ON "guest_credentials" ("adopted_user_id");
ALTER TABLE "game_sessions" ADD COLUMN "adopted_from_guest" uuid;
ALTER TABLE "result_shares" ADD COLUMN "adopted_from_guest" uuid;
