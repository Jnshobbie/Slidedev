"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { PROJECT_TEMPLATES } from "../../constants";
import { useClerk } from "@clerk/nextjs";

const formSchema = z.object({
  value: z.string()
    .min(1, { message: "Message is required" })
    .max(10000, { message: "Message is too long" }),
});

export const ProjectForm = () => {
  const router = useRouter();
  const trpc = useTRPC();
  const clerk = useClerk();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { value: "" },
  });

  const onSelect = (value: string) => {
    form.setValue("value", value, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
  };

  const createProject = useMutation(trpc.projects.create.mutationOptions({
    onSuccess: (data) => {
      queryClient.invalidateQueries(trpc.projects.getMany.queryOptions());
      queryClient.invalidateQueries(trpc.usage.status.queryOptions());
      router.push(`/projects/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
      if (error.data?.code === "UNAUTHORIZED") clerk.openSignIn();
      if (error.data?.code === "TOO_MANY_REQUESTS") router.push("/pricing");
    },
  }));

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createProject.mutateAsync({ value: values.value });
  };

  const [isFocused, setIsFocused] = useState(false);
  const isPending = createProject.isPending;
  const isButtonDisabled = isPending || !form.formState.isValid;

  return (
    <Form {...form}>
      <section className="space-y-6">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          style={{
            backgroundColor: "rgba(40, 40, 40, 0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "18px",
            padding: "18px 20px",
            boxShadow: isFocused
              ? "0 0 0 1px rgba(59,130,246,0.4), 0 4px 12px rgba(0,0,0,0.25)"
              : "0 1px 6px rgba(0,0,0,0.25)",
            backdropFilter: "blur(12px)",
            transition: "all 0.3s ease",
          }}
          className="relative w-full transition-all"
        >
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <TextareaAutosize
                {...field}
                disabled={isPending}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                minRows={2}
                maxRows={8}
                placeholder="What would you like to build?"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    form.handleSubmit(onSubmit)(e);
                  }
                }}
                style={{
                  width: "100%",
                  background: "#2b2b2b",
                  color: "#ffffff",
                  fontSize: "17px",
                  lineHeight: "1.5",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "14px",
                  padding: "12px 16px",
                  outline: "none",
                  resize: "none",
                  fontWeight: 500,
                  transition: "border 0.2s ease, box-shadow 0.2s ease",
                }}
              />
            )}
          />

          <div className="flex gap-x-2 items-end justify-between pt-3">
            <div style={{ fontSize: "11px", color: "rgba(200,200,200,0.6)", fontFamily: "monospace" }}>
              <kbd
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(80,80,80,0.3)",
                  borderRadius: "6px",
                  padding: "2px 5px",
                }}
              >
                ⌘ Enter
              </kbd>{" "}
              to submit
            </div>

            <Button
              disabled={isButtonDisabled}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: isButtonDisabled ? "rgba(80,80,80,0.6)" : "#3B82F6",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.2s ease",
              }}
            >
              {isPending ? (
                <Loader2Icon style={{ width: "18px", height: "18px" }} className="animate-spin" />
              ) : (
                <ArrowUpIcon style={{ width: "18px", height: "18px" }} />
              )}
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-3 md:gap-4 max-w-3xl mx-auto mt-4">
          {PROJECT_TEMPLATES.map((template) => (
            <Button
              key={template.title}
              variant="outline"
              size="sm"
              className="rounded-lg px-4 py-2 shadow-sm hover:bg-accent hover:text-accent-foreground transition-all"
              onClick={() => onSelect(template.prompt)}
              style={{
                backgroundColor: "rgba(50,50,50,0.8)",
                color: "#e2e2e2",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                fontWeight: 500,
              }}
            >
              <span className="mr-1">{template.emoji}</span>
              {template.title}
            </Button>
          ))}
        </div>
      </section>
    </Form>
  );
};
