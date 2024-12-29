-- CreateTable
CREATE TABLE "user_config" (
    "user_id" VARCHAR NOT NULL,
    "mw_id" VARCHAR,

    CONSTRAINT "user_config_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_config_mw_id_key" ON "user_config"("mw_id");
