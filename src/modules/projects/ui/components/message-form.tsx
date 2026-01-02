"use client";
/* eslint-disable @next/next/no-img-element */

import { z } from "zod";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod"; 
import TextareaAutosize from "react-textarea-autosize"; 
import { ArrowUpIcon, Loader2Icon, PlusIcon, XIcon, ImageIcon, VideoIcon, FileTextIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"; 
import Image from "next/image";

import { cn } from "@/lib/utils"; 
import { useTRPC } from "@/trpc/client";
import { Form, FormField } from "@/components/ui/form";
import { Usage } from "./usage";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
    projectId: string;
}

const formSchema = z.object({
    value: z.string()
            .min(1, {message: "Message is required"})
            .max(10000, {message: "Message is too long"}),  
})

interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

export const MessageForm = ({ projectId }: Props) => {
    
    const trpc = useTRPC();
    const router = useRouter();
    const queryClient = useQueryClient(); 

    const { data: usage } = useQuery(trpc.usage.status.queryOptions());
    const [attachments, setAttachments] = useState<FileAttachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const { startUpload } = useUploadThing("messageAttachment");

    // File input refs - CRITICAL for upload to work
    const fileInputRefs = {
        image: useRef<HTMLInputElement>(null),
        video: useRef<HTMLInputElement>(null),
        pdf: useRef<HTMLInputElement>(null),
    };

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            value: "",
        },
    });

    const createMessage = useMutation(trpc.messages.create.mutationOptions({
        onSuccess: () => {
            form.reset();
            setAttachments([]);
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        console.log("🎯 handleFileSelect called with files:", files.length);
        if (files.length === 0) {
            console.log("⚠️ No files selected");
            return;
        }

        console.log("📤 Starting upload for files:", files.map(f => ({ name: f.name, type: f.type, size: f.size })));
        setIsUploading(true);
        toast.loading(`Uploading ${files.length} file(s)...`, { id: "upload" });
        
        try {
            const uploadedFiles = await startUpload(files);
            console.log("✅ Upload complete:", uploadedFiles);
            
            if (uploadedFiles && uploadedFiles.length > 0) {
                const newAttachments: FileAttachment[] = uploadedFiles.map((uploadedFile, index) => {
                    const originalFile = files[index];
                    const attachment = {
                        url: uploadedFile.url,
                        name: originalFile.name,
                        size: originalFile.size,
                        type: originalFile.type || uploadedFile.type || 'application/octet-stream',
                    };
                    console.log(`🔎 Creating attachment [${index}]:`, attachment);
                    return attachment;
                });
                
                console.log("🔎 New attachments array:", newAttachments);
                setAttachments(prev => {
                    const updated = [...prev, ...newAttachments];
                    console.log("📋 Updated attachments state:", updated);
                    return updated;
                });
                toast.success(`${files.length} file(s) uploaded successfully`, { id: "upload" });
            } else {
                console.error("❌ No files returned from upload");
                toast.error("Upload failed - no files returned", { id: "upload" });
            }
        } catch (error) {
            console.error("❌ Upload error:", error);
            toast.error("Failed to upload files", { id: "upload" });
        } finally {
            setIsUploading(false);
            e.target.value = "";
        }
    };

    const triggerFileInput = (type: 'image' | 'video' | 'pdf') => {
        console.log("🖱️ Triggering file input for type:", type);
        const input = fileInputRefs[type].current;
        if (input) {
            input.click();
        } else {
            console.error("❌ File input ref not found for type:", type);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
        toast.success("File removed");
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        await createMessage.mutateAsync({
            value: values.value,
            projectId,
            attachments: attachments.length > 0 ? attachments : undefined,
        });
    };
    
    const [isFocused, setIsFocused] = useState(false); 
    const isPending = createMessage.isPending;
    const isButtonDisabled = isPending || !form.formState.isValid || isUploading;
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
            {/* File Attachments Preview */}
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 p-2 rounded-md bg-muted/50">
                    {attachments.map((file, index) => {
                        const isImage = file.type.startsWith('image/');
                        const isVideo = file.type.startsWith('video/');
                        
                        return (
                            <div key={index} className="relative group">
                                {isImage ? (
                                    <div className="relative">
                                        <img
                                            src={file.url}
                                            alt={file.name}
                                            className="rounded-md object-cover h-20 w-20"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(index)}
                                            className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <XIcon className="size-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1 bg-background rounded-md p-2 w-20 h-20 justify-center relative">
                                        {isVideo ? <VideoIcon className="size-5" /> : <FileTextIcon className="size-5" />}
                                        <span className="text-[10px] truncate w-full text-center">{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(index)}
                                            className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <XIcon className="size-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

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
            <div className="flex gap-x-2 items-center justify-between pt-2 mt-1 border-t no-border-dark">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                       <kbd className="inline-flex h-5 select-none items-center gap-0.5 rounded px-1.5 font-mono text-[10px] font-medium text-muted-foreground border no-border-dark bg-muted shadow-sm dark:shadow-none">
                        <span className="text-xs">{"\u2318"}</span>
                        <span>Enter</span>
                       </kbd>
                       <span>to submit</span>
                    </div>

                    {/* Hidden file inputs */}
                    <input
                        ref={fileInputRefs.image}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        disabled={isUploading || isPending}
                        className="hidden"
                    />
                    <input
                        ref={fileInputRefs.video}
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={handleFileSelect}
                        disabled={isUploading || isPending}
                        className="hidden"
                    />
                    <input
                        ref={fileInputRefs.pdf}
                        type="file"
                        accept=".pdf"
                        multiple
                        onChange={handleFileSelect}
                        disabled={isUploading || isPending}
                        className="hidden"
                    />

                    {/* File Upload Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                disabled={isUploading || isPending}
                                className={cn(
                                    "inline-flex items-center justify-center rounded-full transition-all",
                                    "h-7 w-7 hover:bg-accent",
                                    isUploading && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isUploading ? (
                                    <Loader2Icon className="size-4 animate-spin" />
                                ) : (
                                    <PlusIcon className="size-4 text-muted-foreground" />
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuItem 
                                onSelect={(e) => {
                                    e.preventDefault();
                                    triggerFileInput('image');
                                }}
                            >
                                <ImageIcon className="size-4" />
                                <span>Upload Images</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onSelect={(e) => {
                                    e.preventDefault();
                                    triggerFileInput('video');
                                }}
                            >
                                <VideoIcon className="size-4" />
                                <span>Upload Videos</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onSelect={(e) => {
                                    e.preventDefault();
                                    triggerFileInput('pdf');
                                }}
                            >
                                <FileTextIcon className="size-4" />
                                <span>Upload PDFs</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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