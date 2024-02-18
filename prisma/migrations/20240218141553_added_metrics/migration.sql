-- CreateTable
CREATE TABLE "metrics" (
    "id" VARCHAR NOT NULL,
    "jsonb" JSON NOT NULL,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);
