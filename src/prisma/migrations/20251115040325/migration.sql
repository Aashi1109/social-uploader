/*
  Warnings:

  - You are about to drop the column `scope` on the `secrets` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "secrets_scope_idx";

-- AlterTable
ALTER TABLE "secrets" DROP COLUMN "scope",
ADD COLUMN     "project_id" TEXT;

-- AddForeignKey
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
