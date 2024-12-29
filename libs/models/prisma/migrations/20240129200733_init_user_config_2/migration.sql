/*
  Warnings:

  - You are about to drop the `user_config` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "user_config";

-- CreateTable
CREATE TABLE "user_configs" (
    "user_id" VARCHAR NOT NULL,
    "mw_id" VARCHAR,

    CONSTRAINT "user_configs_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_configs_mw_id_key" ON "user_configs"("mw_id");
