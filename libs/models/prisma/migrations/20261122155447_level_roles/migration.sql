-- CreateTable
CREATE TABLE "level_roles" (
    "guild_id" VARCHAR NOT NULL,
    "role_id" VARCHAR NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "level_roles_pkey" PRIMARY KEY ("guild_id","role_id")
);
