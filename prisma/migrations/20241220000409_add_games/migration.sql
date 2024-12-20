-- CreateTable
CREATE TABLE "game_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "game_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_result" (
    "id" VARCHAR NOT NULL,
    "game_type_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "game_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_player" (
    "id" VARCHAR NOT NULL,
    "game_result_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "result" INTEGER NOT NULL,
    "move" TEXT,

    CONSTRAINT "game_player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_type_name_key" ON "game_type"("name");

-- AddForeignKey
ALTER TABLE "game_result" ADD CONSTRAINT "game_result_game_type_id_fkey" FOREIGN KEY ("game_type_id") REFERENCES "game_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_player" ADD CONSTRAINT "game_player_game_result_id_fkey" FOREIGN KEY ("game_result_id") REFERENCES "game_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
