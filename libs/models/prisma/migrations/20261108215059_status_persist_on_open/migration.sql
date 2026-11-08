-- DropIndex
DROP INDEX "user_statuses_user_id_idx";

-- AlterTable
ALTER TABLE "user_statuses" ALTER COLUMN "ended_at" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "user_statuses_user_id_created_at_idx" ON "user_statuses"("user_id", "created_at");
