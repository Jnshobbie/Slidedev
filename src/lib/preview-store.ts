// src/lib/preview-store.ts
import { prisma } from "@/lib/db";
import crypto from "node:crypto";

export function hashCode(code: string, entry: string): string {
  return crypto.createHash("sha256").update(code + "::" + entry).digest("hex").slice(0, 16);
}

export async function savePreview(userId: string, code: string, entry: string) {
  const hash = hashCode(code, entry);
  await prisma.mobilePreview.upsert({
    where: { hash },
    update: { code, entry, userId },
    create: { hash, userId, code, entry },
  });
  return hash;
}

export async function getPreview(hash: string) {
  return prisma.mobilePreview.findUnique({ where: { hash } });
}

export async function deleteStalePreviews(olderThanHours = 24) {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  return prisma.mobilePreview.deleteMany({ where: { updatedAt: { lt: cutoff } } });
}