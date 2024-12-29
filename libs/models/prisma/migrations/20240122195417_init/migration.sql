-- CreateTable
CREATE TABLE "guild_configurations" (
    "guild_id" VARCHAR NOT NULL,
    "prefix" VARCHAR NOT NULL DEFAULT '!',
    "welcome_channel_id" VARCHAR,
    "welcome_message" VARCHAR(200) NOT NULL DEFAULT 'Welcome @member',
    "goodbye_message" VARCHAR(200) NOT NULL DEFAULT 'Goodbye @member',

    CONSTRAINT "guild_configurations_pkey" PRIMARY KEY ("guild_id")
);

-- CreateTable
CREATE TABLE "guild_stats" (
    "id" VARCHAR NOT NULL,
    "guild_id" VARCHAR NOT NULL,
    "member_id" VARCHAR NOT NULL,
    "issued_by_id" VARCHAR,
    "channel_id" VARCHAR NOT NULL,
    "new_channel_id" VARCHAR,
    "type" VARCHAR NOT NULL,
    "issued_on" TIMESTAMP(6) NOT NULL,
    "ended_on" TIMESTAMP(6),

    CONSTRAINT "guild_stats_pkey" PRIMARY KEY ("id")
);
