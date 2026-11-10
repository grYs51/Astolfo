/*
  Warnings:

  - You are about to drop the column `privacy_hidden` on the `user_configs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_configs" DROP COLUMN "privacy_hidden";
