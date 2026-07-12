-- DropIndex
DROP INDEX "user_session_access_token_key";

-- DropIndex
DROP INDEX "user_session_refresh_token_key";

-- CreateIndex
CREATE INDEX "message_stats_guild_id_user_id_idx" ON "message_stats"("guild_id", "user_id");

-- CreateIndex
CREATE INDEX "message_stats_guild_id_created_at_idx" ON "message_stats"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "user_statuses_user_id_idx" ON "user_statuses"("user_id");

-- CreateIndex
CREATE INDEX "voice_stats_guild_id_member_id_idx" ON "voice_stats"("guild_id", "member_id");

-- CreateIndex
CREATE INDEX "voice_stats_guild_id_type_idx" ON "voice_stats"("guild_id", "type");

-- CreateIndex
CREATE INDEX "voice_stats_guild_id_issued_on_idx" ON "voice_stats"("guild_id", "issued_on");

-- CreateIndex
CREATE INDEX "voice_stats_member_id_idx" ON "voice_stats"("member_id");
