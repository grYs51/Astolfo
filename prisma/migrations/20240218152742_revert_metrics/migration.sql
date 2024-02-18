/*
  Warnings:

  - You are about to drop the column `commands_counter` on the `metrics` table. All the data in the column will be lost.
  - You are about to drop the column `errors_counter` on the `metrics` table. All the data in the column will be lost.
  - You are about to drop the column `events_counter` on the `metrics` table. All the data in the column will be lost.
  - You are about to drop the column `slashs_counter` on the `metrics` table. All the data in the column will be lost.
  - You are about to drop the column `warnings_counter` on the `metrics` table. All the data in the column will be lost.
  - Added the required column `jsonb` to the `metrics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "metrics" DROP COLUMN "commands_counter",
DROP COLUMN "errors_counter",
DROP COLUMN "events_counter",
DROP COLUMN "slashs_counter",
DROP COLUMN "warnings_counter",
ADD COLUMN     "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "jsonb" JSONB NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
