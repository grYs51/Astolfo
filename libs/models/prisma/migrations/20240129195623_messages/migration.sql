/*
  Warnings:

  - You are about to drop the `guild_stats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "guild_stats";

-- CreateTable
CREATE TABLE "voice_stats" (
    "id" VARCHAR NOT NULL,
    "guild_id" VARCHAR NOT NULL,
    "member_id" VARCHAR NOT NULL,
    "issued_by_id" VARCHAR,
    "channel_id" VARCHAR NOT NULL,
    "new_channel_id" VARCHAR,
    "type" VARCHAR NOT NULL,
    "issued_on" TIMESTAMP(6) NOT NULL,
    "ended_on" TIMESTAMP(6),

    CONSTRAINT "voice_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_stats" (
    "id" VARCHAR NOT NULL,
    "guild_id" VARCHAR NOT NULL,
    "member_id" VARCHAR NOT NULL,
    "channel_id" VARCHAR NOT NULL,
    "issued_on" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "message_stats_pkey" PRIMARY KEY ("id")
);
