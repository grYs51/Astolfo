/*
  Warnings:

  - You are about to drop the column `issued_by_id` on the `voice_stats` table. All the data in the column will be lost.
  - You are about to drop the column `new_channel_id` on the `voice_stats` table. All the data in the column will be lost.
  - Made the column `ended_at` on table `user_statuses` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ended_on` on table `voice_stats` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "user_activities" ALTER COLUMN "created_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_statuses" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "ended_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "voice_stats" DROP COLUMN "issued_by_id",
DROP COLUMN "new_channel_id",
ALTER COLUMN "ended_on" SET NOT NULL;
