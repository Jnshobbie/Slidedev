import { z } from "zod";
import { generateSlug } from "random-word-slugs";

import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { consumeCredits } from "@/lib/usage";
import type { FigmaImportResult } from "@/lib/figma/types";
import { runCodeAgentJob } from "@/lib/code-agent-runner";

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
      
      // Call the runner directly (fire and forget - don't await to return immediately)
      // This avoids HTTP fetch issues and runs in the same process
      runCodeAgentJob({
        projectId: createdProject.id,
        value: input.value,
        attachments: input.attachments || undefined,
        figmaData: input.figmaData || undefined,
      }).catch((error) => {
        console.error('❌ Failed to run GPT-5.2 job:', error);
        console.error('❌ Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Don't throw - we've already created the project, so we don't want to fail the mutation
      });

      console.log('✅ GPT-5.2 job initiated from projects');

      return createdProject;
    }),
});