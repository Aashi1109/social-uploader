/*
  Warnings:

  - Changed the type of `type` on the `secrets` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "secrets" DROP COLUMN "type",
ADD COLUMN     "type" "PlatformName" NOT NULL;

-- CreateIndex
CREATE INDEX "secrets_type_idx" ON "secrets"("type");
