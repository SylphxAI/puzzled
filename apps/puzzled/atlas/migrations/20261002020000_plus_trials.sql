-- The reverse trial: every game for seven days after a player's third finished
-- day, once per account. One row per account is the one-grant rule; the row
-- stays after the trial ends so a second grant never happens. Puzzled's own
-- time-boxed access, not a billing table.
CREATE TABLE "plus_trials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL
);
