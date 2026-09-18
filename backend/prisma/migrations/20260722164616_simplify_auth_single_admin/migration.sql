-- Rename email -> username (data preserved; reseed will normalize to the single admin user)
ALTER TABLE "User" RENAME COLUMN "email" TO "username";
ALTER INDEX "User_email_key" RENAME TO "User_username_key";

-- Single-admin system: role differentiation is no longer needed
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";
