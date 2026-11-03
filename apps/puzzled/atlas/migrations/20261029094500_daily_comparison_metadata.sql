-- Expand only. Old Cryptogram hints are unknown, not invented as zero.
ALTER TABLE game_sessions ADD COLUMN hints_used bigint;
-- Verification can opt out of public comparisons, never opt an unaccepted row in.
ALTER TABLE game_sessions ADD COLUMN comparison_excluded boolean NOT NULL DEFAULT false;
