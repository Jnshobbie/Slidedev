import { z } from "zod";
import { generateSlug } from "random-word-slugs";

import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { consumeCredits, consumeSmartExportCredit } from "@/lib/usage";
import type { FigmaImportResult } from "@/lib/figma/types";
import { generateCode } from "@/trigger/generate-code";

const fileAttachmentSchema = z.object({
  url: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
});

export const projectsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(z.object({
      id: z.string().min(1, { message: "Id is required" }),
    }))
    .query(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.id,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      return existingProject;
    }),
  getMany: protectedProcedure
    .query(async ({ ctx }) => {
      const projects = await prisma.project.findMany({
        where: {
          userId: ctx.auth.userId,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      return projects;
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Value is required " })
          .max(10000, { message: "Value is required " }),
        projectType: z.enum(["web", "mobile"]).default("web"),
        attachments: z.array(fileAttachmentSchema).optional(),
        figmaData: z.custom<FigmaImportResult>().optional(),
        model: z.string().optional(),
        gsapMode: z.boolean().optional(),
        importId: z.string().optional(),
        mode: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {

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

      const createdProject = await prisma.project.create({
        data: {
          model: input.model || "gpt-5.2", // default, user can change later
          gsapMode: input.gsapMode ?? false,
          userId: ctx.auth.userId,
          name: generateSlug(2, {
            format: "kebab",
          }),
          projectType: input.projectType, // Save projectType to database
          messages: {
            create: {
              content: input.value,
              role: "USER",
              type: "RESULT",
              attachments: input.attachments || undefined,
            }
          }
        }
      });

      // Call GPT-5.2 directly (bypassing Inngest)
      console.log('🚀 Calling GPT-5.2 directly from projects (bypassing Inngest)');

      let smartDesignData = undefined;
      if (input.importId && input.mode === 'smart') {
        try {
          await consumeSmartExportCredit();
        } catch {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of Smart Export credits"
          });
        }
        const figmaImport = await prisma.figmaImport.findUnique({
          where: { importId: input.importId }
        });
        if (figmaImport) {
          smartDesignData = {
            fileName: figmaImport.fileName,
            nodes: JSON.parse(figmaImport.designData),
            imageUrls: JSON.parse(figmaImport.imageUrls),
            sectionImages: figmaImport.sectionImages ? JSON.parse(figmaImport.sectionImages) : {},
          };
        }
      }

      await generateCode.trigger({
        projectId: createdProject.id,
        model: createdProject.model,
        gsapMode: createdProject.gsapMode,
        value: input.value,
        attachments: input.attachments,
        figmaData: input.figmaData,
        smartDesignData, // Pass the smart design data if available
      });

      console.log('✅ GPT-5.2 job initiated from projects');

      return createdProject;
    }),

    delete: protectedProcedure
    .input(z.object({
      id: z.string().min(1, { message: "Id is required" }),
    }))
    .mutation(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.id,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      await prisma.project.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});