-- AlterTable
ALTER TABLE "guild_configs" ALTER COLUMN "goodbye_message" SET DEFAULT '';

-- Goodbye posts were never sent, so every 'Goodbye @member' is the old default, not a choice
UPDATE "guild_configs" SET "goodbye_message" = '' WHERE "goodbye_message" = 'Goodbye @member';
