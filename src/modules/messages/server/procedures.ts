import { z } from "zod";

import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { consumeCredits } from "@/lib/usage";

const fileAttachmentSchema = z.object({
  url: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
});

export const messagesRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ input, ctx }) => {
      const messages = await prisma.message.findMany({
        where: {
          projectId: input.projectId,
          project: {
            userId: ctx.auth.userId,
          },
        },
        include: {
          fragment: true,
        },
        orderBy: {
          updatedAt: "asc",
        },
      });

      return messages;
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Message is required " })
          .max(10000, { message: "Message is too long " }),
        projectId: z.string().min(1, { message: "Project ID is required" }),
        projectType: z.enum(["web", "mobile"]).optional(),
        attachments: z.array(fileAttachmentSchema).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.projectId,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" })
      }

      try {
        await consumeCredits();
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Something went wrong" });
        } else {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of credits"
          });
        }
      }

      const createdMessage = await prisma.message.create({
        data: {
          projectId: existingProject.id,
          content: input.value,
          role: "USER",
          type: "RESULT",
          attachments: input.attachments || undefined,
        }
      });

      console.log('✅ Message created:', createdMessage.id);
      console.log('🚀 Calling GPT-5.2 API (message)');

      // Build URL that works in both production and preview deployments
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = process.env.VERCEL_URL || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;

      console.log('📍 API URL:', `${baseUrl}/api/ai/generate`);

      // Fire and forget - don't await
      fetch(`${baseUrl}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: input.projectId,
          value: input.value,
          projectType: existingProject.projectType,
          attachments: input.attachments,
        })
      }).then(res => res.json()).then(result => {
        console.log('✅ GPT-5.2 completed (message):', result);
      }).catch(error => {
        console.error('❌ GPT-5.2 error (message):', error);
      });

      console.log('✅ Returning message to user');

      return createdMessage;
    }),
});