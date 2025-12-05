"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod"; 
import  TextareaAutosize  from "react-textarea-autosize"; 
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"; 

import { cn } from  "@/lib/utils"; 
import { useTRPC } from "@/trpc/client";
import { Form, FormField } from "@/components/ui/form";
import { Usage } from "./usage";
import { useRouter } from "next/navigation";

interface Props {
    projectId: string;
}

const formSchema = z.object ({
    value: z.string()
            .min(1, {message: "Message is required "})
            .max(10000, {message: "Message is too long "}),  
})

export const MessageForm = ({ projectId }: Props) => {
    
    const trpc = useTRPC();
    const router = useRouter();
    const queryClient = useQueryClient(); 

    const { data: usage } = useQuery(trpc.usage.status.queryOptions());

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            value: "",
        },
    });

    const createMessage = useMutation(trpc.messages.create.mutationOptions({
        onSuccess: () => {
            form.reset(); 
            queryClient.invalidateQueries(
                trpc.messages.getMany.queryOptions({ projectId }),
            );
            queryClient.invalidateQueries(
              trpc.usage.status.queryOptions()
            );
        },
        onError: (error) => {
            toast.error(error.message);

            if (error.data?.code === "TOO_MANY_REQUESTS") {
              router.push("/pricing"); 
            }
        },
    }));

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        await createMessage.mutateAsync({
            value: values.value,
            projectId,
        });
    };
    
    const [isFocused, setIsFocused] = useState(false); 
    const isPending = createMessage.isPending;
    const isButtonDisabled= isPending || !form.formState.isValid;
    const showUsage = !!usage;

    return (
        <Form {...form}>
          {showUsage && (
            <Usage 
            points={usage.remainingPoints}
            msBeforeNext={usage.msBeforeNext}
            />
          )}
            <form 
              onSubmit={form.handleSubmit(onSubmit)}
              className={cn(
                "relative rounded-xl p-3 transition-all",
                "border no-border-dark bg-card shadow-sm",
                "dark:bg-sidebar dark:shadow-none",
                isFocused && "ring-2 ring-primary/20 border-primary/50 dark:border-primary/30", 
                showUsage && "rounded-t-none border-t-0 dark:border-t-0",
              )}
            >
            <FormField 
              control={form.control}
              name="value"
              render={({ field }) => (
                <TextareaAutosize 
                  {...field}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}    
                  minRows={2}
                  maxRows={8}
                  className="w-full resize-none border-none outline-none bg-transparent text-foreground placeholder:text-muted-foreground text-sm leading-relaxed"
                  placeholder="what do you want to build"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        form.handleSubmit(onSubmit)(e);
                    }
                  }}        
                />
              )}
            />
            <div className="flex gap-x-2 items-center justify-between pt-2 mt-1 border-t border-border/30 dark:border-transparent">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                   <kbd className="inline-flex h-5 select-none items-center gap-0.5 rounded px-1.5 font-mono text-[10px] font-medium text-muted-foreground border border-border/50 bg-muted shadow-sm dark:border-transparent dark:shadow-none">
                    <span className="text-xs">{"\u2318"}</span>
                    <span>Enter</span>
                   </kbd>
                   <span>to submit</span>
                </div>
                <button
                  type="submit"
                  disabled={isButtonDisabled}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full transition-all duration-200 shrink-0",
                    "size-8",
                    "[&_svg]:size-4 [&_svg]:shrink-0",
                    isButtonDisabled
                      ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                      : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 hover:shadow"
                  )}
                >
                  {isPending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : ( 
                    <ArrowUpIcon />
                  )}
                </button>
            </div>
            </form>
        </Form>
    );
};