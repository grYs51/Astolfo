-- AlterTable
ALTER TABLE "guild_configs" ADD COLUMN     "level_up_channel_id" VARCHAR;

-- CreateTable
CREATE TABLE "xp_events" (
    "id" VARCHAR NOT NULL,
    "guild_id" VARCHAR NOT NULL,
    "member_id" VARCHAR NOT NULL,
    "source" VARCHAR NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" VARCHAR NOT NULL,
    "segments" JSONB,
    "key" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_rules" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "rules" JSONB NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_key_key" ON "xp_events"("key");

-- CreateIndex
CREATE INDEX "xp_events_guild_id_member_id_created_at_idx" ON "xp_events"("guild_id", "member_id", "created_at");

-- CreateIndex
CREATE INDEX "game_result_guild_id_game_type_id_idx" ON "game_result"("guild_id", "game_type_id");

-- CreateIndex
CREATE INDEX "game_player_user_id_idx" ON "game_player"("user_id");

-- CreateIndex
CREATE INDEX "game_player_game_result_id_idx" ON "game_player"("game_result_id");
