-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "gsapMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GsapAnimationPattern" (
    "id" TEXT NOT NULL,
    "technique" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "params" JSONB,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GsapAnimationPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GsapAnimationPattern_mood_idx" ON "GsapAnimationPattern"("mood");

-- CreateIndex
CREATE INDEX "GsapAnimationPattern_technique_idx" ON "GsapAnimationPattern"("technique");
