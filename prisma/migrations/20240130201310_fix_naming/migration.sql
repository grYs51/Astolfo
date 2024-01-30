/*
  Warnings:

  - You are about to drop the `guild_configurations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "guild_configurations";

-- CreateTable
CREATE TABLE "guild_configs" (
    "guild_id" VARCHAR NOT NULL,
    "prefix" VARCHAR NOT NULL DEFAULT '!',
    "welcome_channel_id" VARCHAR,
    "welcome_message" VARCHAR(200) NOT NULL DEFAULT 'Welcome @member',
    "goodbye_message" VARCHAR(200) NOT NULL DEFAULT 'Goodbye @member',

    CONSTRAINT "guild_configs_pkey" PRIMARY KEY ("guild_id")
);
