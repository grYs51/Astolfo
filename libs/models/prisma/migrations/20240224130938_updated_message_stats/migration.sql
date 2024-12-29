/*
  Warnings:

  - You are about to drop the column `member_id` on the `message_stats` table. All the data in the column will be lost.
  - Added the required column `message_id` to the `message_stats` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `message_stats` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "message_stats" DROP COLUMN "member_id",
ADD COLUMN     "message_id" VARCHAR NOT NULL,
ADD COLUMN     "user_id" VARCHAR NOT NULL;
