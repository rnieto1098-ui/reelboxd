-- AlterTable
-- SQLite allows a REFERENCES clause on ADD COLUMN only when the new column
-- defaults to NULL, which this one does.
ALTER TABLE "Challenge" ADD COLUMN "listId" TEXT REFERENCES "List" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Challenge_listId_idx" ON "Challenge"("listId");
