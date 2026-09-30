-- Platform erasure fan-out (end-user-principal.md section 9): one row per
-- Auth `user.deletion_requested` request this service has handled. The
-- request id makes a redelivery a no-op; the evidence is stored so a replay
-- answers with the same rows, and is re-sent until Auth has it. It holds
-- counts and reasons only, never a user or player id.
CREATE TABLE "erasure_requests" (
	"request_id" text PRIMARY KEY,
	"evidence" jsonb NOT NULL,
	"evidence_posted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
