-- Persist-on-open: a voice_stats row is now inserted when a session *starts*
-- and closed when it ends, so an open session is `ended_on = NULL`.
-- 20241223132046_removing_unused_stuff had made the column required, which
-- rejects every insert the current code makes (P2011 on `ended_on`).
-- AlterTable
ALTER TABLE "voice_stats" ALTER COLUMN "ended_on" DROP NOT NULL;
