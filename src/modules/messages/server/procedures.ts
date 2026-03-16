import { z } from "zod";

import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { consumeCredits } from "@/lib/usage";
import { generateCode } from "@/trigger/generate-code";

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
        projectType: z.enum(["web", "mobile"]).optional(), // NEW: Optional projectType (form selector)
        attachments: z.array(fileAttachmentSchema).optional(),
        model: z.string().optional(), // NEW: Optional model field for message-level model selection
        importId: z.string().optional(),
        mode: z.string().optional(),
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

      // Call GPT-5.2 directly (bypassing Inngest)
      console.log('🚀 Calling GPT-5.2 directly from messages (bypassing Inngest)');

      let smartDesignData = undefined;
      if (input.importId && input.mode === 'smart') {
        const figmaImport = await prisma.figmaImport.findUnique({
          where: { importId: input.importId }
        });
        if (figmaImport) {
          smartDesignData = {
            fileName: figmaImport.fileName,
            nodes: JSON.parse(figmaImport.designData),
            imageUrls: JSON.parse(figmaImport.imageUrls),
          };
        }
      }

      // Call the runner directly (fire and forget - don't await to return immediately)
      // This avoids HTTP fetch issues and runs in the same process
      await generateCode.trigger({
        projectId: existingProject.id,
        model: existingProject.model,
        value: input.value,
        attachments: input.attachments,
        smartDesignData, // Pass the smart design data if available
      });

      console.log('✅ GPT-5.2 job initiated from messages');

      return createdMessage;
    }),
});