-- DropIndex
DROP INDEX "user_statuses_user_id_created_at_idx";

-- CreateIndex
CREATE INDEX "user_statuses_user_id_ended_at_idx" ON "user_statuses"("user_id", "ended_at");
