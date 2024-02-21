/*
  Warnings:

  - You are about to drop the column `issued_on` on the `message_stats` table. All the data in the column will be lost.
  - Added the required column `created_at` to the `message_stats` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "message_stats" DROP COLUMN "issued_on",
ADD COLUMN     "created_at" TIMESTAMP(6) NOT NULL;

-- CreateTable
CREATE TABLE "user_statuses" (
    "id" VARCHAR NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "status" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(6),

    CONSTRAINT "user_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" VARCHAR NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "activity_id" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);
