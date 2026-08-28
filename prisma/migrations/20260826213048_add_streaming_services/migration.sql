-- CreateTable
CREATE TABLE "StreamingService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" INTEGER NOT NULL,
    "providerName" TEXT NOT NULL,
    "logoPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "StreamingService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamingService_userId_providerId_key" ON "StreamingService"("userId", "providerId");
