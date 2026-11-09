-- AlterTable
ALTER TABLE "user_session" ADD COLUMN     "created_at" TIMESTAMP(6),
ADD COLUMN     "last_login_at" TIMESTAMP(6);

-- CreateTable
CREATE TABLE "metric_daily" (
    "day" DATE NOT NULL,
    "name" VARCHAR NOT NULL,
    "label" VARCHAR NOT NULL,
    "value" BIGINT NOT NULL,

    CONSTRAINT "metric_daily_pkey" PRIMARY KEY ("day","name","label")
);

-- CreateTable
CREATE TABLE "guild_events" (
    "id" VARCHAR NOT NULL,
    "guild_id" VARCHAR NOT NULL,
    "type" VARCHAR NOT NULL,
    "at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_views" (
    "day" DATE NOT NULL,
    "path" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("day","path","user_id")
);

-- CreateIndex
CREATE INDEX "guild_events_at_idx" ON "guild_events"("at");

