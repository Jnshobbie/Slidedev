-- CreateTable
CREATE TABLE "IdeConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "folderPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeMessage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IdeMessage" ADD CONSTRAINT "IdeMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "IdeConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
