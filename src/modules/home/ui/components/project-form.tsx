"use client"

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

const formSchema = z.object({
  value: z.string()
    .min(1, { message: "Message is required " })
    .max(10000, { message: "Message is too long " }),
})

export const ProjectForm = () => {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: "",
    },
  });

  const onSelect = (value: string) => {
    form.setValue("value", value, {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });
  };

  const createProject = useMutation(trpc.projects.create.mutationOptions({
    onSuccess: (data) => {
      queryClient.invalidateQueries(
        trpc.projects.getMany.queryOptions(),
      );
      router.push(`/projects/${data.id}`);
      // TODO LATER
    },
    onError: (error) => {
      // WILL BE REDIRECT TO PRICING PAGE
      toast.error(error.message);
    },
  }));

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createProject.mutateAsync({
      value: values.value,
    });
  };

  const [isFocused, setIsFocused] = useState(false);
  const isPending = createProject.isPending;
  const isButtonDisabled = isPending || !form.formState.isValid;


  return (
    <Form {...form}>
      <section className="space-y-6">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "relative w-full border border-border bg-background rounded-lg px-4 py-3 shadow-sm transition-all",
            isFocused && "ring-1 ring-ring shadow-md"
          )}
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
                className="w-full resize-none border-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground"
                placeholder="What would you like to build?"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    form.handleSubmit(onSubmit)(e);
                  }
                }}
              />

            )}
          />
          <div className="flex gap-x-2 items-end justify-between pt-2">
            <div className="text-[10px] text-muted-foreground font-mono">
              <kbd className="ml-auto pointer-events-auto inline-flex h-5 select-none items-center
                   gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span>{"\u2318"} </span>Enter
              </kbd>
              &nbsp;to submit
            </div>
            <Button
              disabled={isButtonDisabled}
              className={cn(
                "size-8 rounded-full",
                isButtonDisabled && "bg-muted-foreground border"
              )}
            >
              {isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <ArrowUpIcon />
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
