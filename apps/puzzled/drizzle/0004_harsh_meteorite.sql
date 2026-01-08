CREATE INDEX "game_sessions_completed_at_idx" ON "game_sessions" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "game_sessions_status_idx" ON "game_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_sessions_archive_date_idx" ON "game_sessions" USING btree ("archive_date");--> statement-breakpoint
CREATE INDEX "game_sessions_game_status_completed_idx" ON "game_sessions" USING btree ("game_id","status","completed_at");