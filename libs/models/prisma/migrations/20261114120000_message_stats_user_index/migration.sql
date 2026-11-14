-- CreateIndex
CREATE INDEX "message_stats_user_id_guild_id_idx" ON "message_stats"("user_id", "guild_id");
