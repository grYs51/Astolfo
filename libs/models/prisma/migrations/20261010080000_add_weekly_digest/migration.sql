-- AlterTable
ALTER TABLE "guild_configs" ADD COLUMN     "digest_channel_id" VARCHAR,
ADD COLUMN     "digest_last_sent_at" TIMESTAMP(6);

