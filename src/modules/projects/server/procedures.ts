import { z } from "zod";
import { generateSlug } from "random-word-slugs";

import { prisma } from "@/lib/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { consumeCredits } from "@/lib/usage";
import type { FigmaImportResult } from "@/lib/figma/types";

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
          projectType: input.projectType,
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

      console.log('✅ Project created:', createdProject.id);
      console.log('🚀 Calling GPT-5.2 API (project)');

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
          projectId: createdProject.id,
          value: input.value,
          projectType: createdProject.projectType,
          attachments: input.attachments,
        })
      }).then(res => res.json()).then(result => {
        console.log('✅ GPT-5.2 completed (project):', result);
      }).catch(error => {
        console.error('❌ GPT-5.2 error (project):', error);
      });

      console.log('✅ Returning project to user');

      return createdProject;
    }),
});