// src/lib/code-agent-runner.ts
import { Sandbox } from "@e2b/code-interpreter";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT } from "@/inngest/types";
import { getPromptForProjectType, GPT52_CODE_AGENT_PROMPT, FRAGMENT_TITLE_PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { formatMessagesForGPT5, runGPT5Agent } from "@/lib/gpt5-agent";
import type { FigmaImportResult } from "@/lib/figma/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Attachment = { url: string; type: string; name: string; size: number };

export async function runCodeAgentJob(params: {
  projectId: string;
  value: string;
  attachments?: Attachment[];
  figmaData?: FigmaImportResult;
}) {
  const { projectId, value, attachments, figmaData } = params;

  // 1) Get project type
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { projectType: true },
  });

  const projectType = (project?.projectType as "web" | "mobile") || "web";
  const isMobile = projectType === "mobile";

  // 2) Optional sandbox for web
  const sandboxId = !isMobile
    ? await (async () => {
        const sandbox = await Sandbox.create("slide-nextjs-test-1");
        await sandbox.setTimeout(SANDBOX_TIMEOUT);
        return sandbox.sandboxId;
      })()
    : null;

  // 3) Previous messages
  const dbMessages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const allMessages = [
    ...dbMessages.reverse().map((msg) => ({
      role: msg.role,
      content: msg.content,
      attachments: msg.attachments as Attachment[] | undefined,
    })),
    {
      role: "USER" as const,
      content: value,
      attachments,
    },
  ];

  const gpt5Messages = formatMessagesForGPT5(allMessages);

  // 4) Inject Figma context (same as before)
  if (figmaData) {
    const figmaContext = `
FIGMA DESIGN IMPORTED:
File: ${figmaData.fileName}

Design System Tokens:
Colors: ${JSON.stringify(figmaData.designSystem.colors, null, 2)}
Typography: ${JSON.stringify(figmaData.designSystem.typography, null, 2)}
Spacing: ${JSON.stringify(figmaData.designSystem.spacing, null, 2)}

Tailwind Config:
${JSON.stringify(figmaData.tailwindConfig, null, 2)}

Component Files Extracted:
${Object.keys(figmaData.components).map((name) => `- ${name}`).join("\n")}

Component Code Reference:
${Object.entries(figmaData.components)
  .map(
    ([name, code]) => `
=== ${name} ===
${code}
`
  )
  .join("\n")}
    `.trim();

    gpt5Messages.unshift({
      role: "user",
      content: figmaContext,
    });
  }

  const systemPrompt =
    getPromptForProjectType(projectType) + "\n\n" + GPT52_CODE_AGENT_PROMPT;

  const currentFiles: Record<string, string> = {};

  // 5) Run GPT‑5.2 agent with tools (same tool behavior as Inngest version)
  const gpt5Result = await runGPT5Agent(
    {
      projectType,
      messages: gpt5Messages,
      systemPrompt,
      currentFiles,
      sandboxId: sandboxId || undefined,
    },
    async (toolName, args: { files?: Array<{ path: string; content: string }>; command?: string }) => {
      if (toolName === "createOrUpdateFiles" && !isMobile && sandboxId) {
        const sandbox = await Sandbox.connect(sandboxId);
        await sandbox.setTimeout(SANDBOX_TIMEOUT);
        if (args.files) {
          for (const file of args.files) {
            await sandbox.files.write(file.path, file.content);
            currentFiles[file.path] = file.content;
          }
        }
        return "Files created successfully";
      } else if (toolName === "createOrUpdateFiles" && isMobile) {
        if (args.files) {
          for (const file of args.files) {
            currentFiles[file.path] = file.content;
          }
        }
        return "Files created successfully";
      } else if (toolName === "terminal" && sandboxId && args.command) {
        const sandbox = await Sandbox.connect(sandboxId);
        await sandbox.setTimeout(SANDBOX_TIMEOUT);
        const result = await sandbox.commands.run(args.command);
        return result.stdout;
      } else if (toolName === "readFiles" && sandboxId && args.files) {
        const sandbox = await Sandbox.connect(sandboxId);
        await sandbox.setTimeout(SANDBOX_TIMEOUT);
        const contents = [];
        for (const file of args.files) {
          const content = await sandbox.files.read(file.path);
          contents.push({ path: file.path, content });
        }
        return JSON.stringify(contents);
      }

      return "Tool not available";
    }
  );

  // 6) Title + user‑facing summary (no Inngest agent‑kit)
  const [fragmentTitleResp, responseResp] = await Promise.all([
    openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: FRAGMENT_TITLE_PROMPT },
        { role: "user", content: gpt5Result.summary },
      ],
      temperature: 0.4,
    }),
    openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: RESPONSE_PROMPT },
        { role: "user", content: gpt5Result.summary },
      ],
      temperature: 0.4,
    }),
  ]);

  const fragmentTitle =
    fragmentTitleResp.choices[0]?.message?.content?.trim() || "Fragment";
  const assistantText =
    responseResp.choices[0]?.message?.content?.trim() ||
    "Here's what I built for you.";

  const isError =
    !gpt5Result.summary || Object.keys(gpt5Result.files || {}).length === 0;

  // 7) Optional sandbox URL (web only)
  let sandboxUrl = "mobile-preview://ready";
  if (!isMobile && sandboxId) {
    const sandbox = await Sandbox.connect(sandboxId);
    await sandbox.setTimeout(SANDBOX_TIMEOUT);
    const host = sandbox.getHost(3000);
    sandboxUrl = `https://${host}`;
  }

  // 8) Persist result exactly like before
  if (isError) {
    await prisma.message.create({
      data: {
        projectId,
        content: "something's went wrong. please try again.",
        role: "ASSISTANT",
        type: "ERROR",
      },
    });
  } else {
    // For mobile: extract deps from summary if you still want that
    const dependencies = isMobile ? null : null; // plug your extractDependencies if needed

    await prisma.message.create({
      data: {
        projectId,
        content: assistantText,
        role: "ASSISTANT",
        type: "RESULT",
        fragment: {
          create: {
            sandboxUrl,
            title: fragmentTitle,
            files: gpt5Result.files,
            dependencies: dependencies || undefined,
          },
        },
      },
    });
  }

  return {
    url: sandboxUrl,
    title: fragmentTitle,
    files: gpt5Result.files,
    summary: gpt5Result.summary,
  };
}