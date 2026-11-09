-- CreateTable
CREATE TABLE "guild_settings_changes" (
    "id" VARCHAR NOT NULL,
    "guild_id" VARCHAR NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB NOT NULL,

    CONSTRAINT "guild_settings_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guild_settings_changes_guild_id_at_idx" ON "guild_settings_changes"("guild_id", "at");

