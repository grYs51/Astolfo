-- CreateTable
CREATE TABLE "app_notice" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "text" VARCHAR(300) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_notice_pkey" PRIMARY KEY ("id")
);

