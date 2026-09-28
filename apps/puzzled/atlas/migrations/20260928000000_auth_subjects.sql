-- A player is Puzzled's own entity (user_id uuid). The Sylphx Auth subject that
-- signs them in is another system's id: stored as the exact text Auth published,
-- never decoded (owner standards/identifiers.md). Auth moves its subjects from
-- `principal-<uuid>` to the TypeID `usr_<26>` on 2026-10-04 (cloud#10008); both
-- forms map to the same player here.
CREATE TABLE "auth_subjects" (
	"subject" text PRIMARY KEY NOT NULL, -- identifiers: allow another system's id (Sylphx Auth subject), kept as published
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "auth_subjects_user_id_idx" ON "auth_subjects" USING btree ("user_id");
