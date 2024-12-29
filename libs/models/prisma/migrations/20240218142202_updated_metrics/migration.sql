/*
  Warnings:

  - You are about to drop the column `jsonb` on the `metrics` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "metrics" DROP COLUMN "jsonb",
ADD COLUMN     "commands_counter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errors_counter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "events_counter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slashs_counter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warnings_counter" INTEGER NOT NULL DEFAULT 0;
