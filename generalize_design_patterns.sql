-- Run this against your DB (same way as fix_vector_dimension.sql):
-- npx prisma db execute --file generalize_design_patterns.sql --schema prisma\schema.prisma
--
-- Adds category + usageNote to the existing table. Existing 29 GSAP
-- rows get category='gsap' automatically via the DEFAULT — no data loss,
-- no re-running the GSAP pipeline.

ALTER TABLE "GsapAnimationPattern" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'gsap';
ALTER TABLE "GsapAnimationPattern" ADD COLUMN IF NOT EXISTS "usageNote" TEXT;
CREATE INDEX IF NOT EXISTS "GsapAnimationPattern_category_idx" ON "GsapAnimationPattern"("category");
