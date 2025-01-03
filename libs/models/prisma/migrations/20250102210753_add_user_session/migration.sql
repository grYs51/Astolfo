-- CreateTable
CREATE TABLE "user_session" (
    "id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_session_access_token_key" ON "user_session"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "user_session_refresh_token_key" ON "user_session"("refresh_token");
