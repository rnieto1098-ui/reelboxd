-- AlterTable
ALTER TABLE "List" ADD COLUMN "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "List_key_key" ON "List"("key");
