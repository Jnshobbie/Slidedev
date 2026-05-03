-- CreateTable
CREATE TABLE "IdeUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sonnetTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "opusTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdeUsage_userId_key" ON "IdeUsage"("userId");
