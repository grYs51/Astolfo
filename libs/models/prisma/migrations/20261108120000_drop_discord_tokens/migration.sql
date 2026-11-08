-- Existing rows have no profile (and "username" is NOT NULL), so drop them.
-- Their sessions stop resolving to a user and those users log in again.
DELETE FROM "user_session";

-- AlterTable
ALTER TABLE "user_session" DROP COLUMN "access_token",
DROP COLUMN "refresh_token",
ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "global_name" TEXT,
ADD COLUMN     "username" TEXT NOT NULL;
