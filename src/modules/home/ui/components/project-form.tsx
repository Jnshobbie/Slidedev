"use client";
/* eslint-disable @next/next/no-img-element */

import { z } from "zod";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUpIcon, Loader2Icon, PlusIcon, XIcon, ImageIcon, VideoIcon, FileTextIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { PROJECT_TEMPLATES } from "../../constants";
import { useClerk } from "@clerk/nextjs";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const formSchema = z.object({
  value: z.string()
    .min(1, { message: "Message is required" })
    .max(10000, { message: "Message is too long" }),
});

interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

export const ProjectForm = () => {
  const router = useRouter();
  const trpc = useTRPC();
  const clerk = useClerk();
  const queryClient = useQueryClient();
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  
  // Debug effect
  useEffect(() => {
    console.log("🔍 Current attachments state:", attachments);
    console.log("🔍 Attachments length:", attachments.length);
    if (attachments.length > 0) {
      attachments.forEach((att, idx) => {
        console.log(`  [${idx}] ${att.name} - ${att.type} - ${att.url}`);
      });
    }
  }, [attachments]);
  const [isUploading, setIsUploading] = useState(false);
  const { startUpload } = useUploadThing("messageAttachment");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { value: "" },
  });

  const onSelect = (value: string) => {
    form.setValue("value", value, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
  };

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
        console.log("✅ Upload complete - full response:", JSON.stringify(uploadedFiles, null, 2));
        
        if (uploadedFiles && uploadedFiles.length > 0) {
            const newAttachments: FileAttachment[] = uploadedFiles.map((uploadedFile, index) => {
                const originalFile = files[index];
                const attachment = {
                    url: uploadedFile.url,
                    name: originalFile.name,
                    size: originalFile.size,
                    type: originalFile.type || uploadedFile.type || 'application/octet-stream',
                };
                console.log(`📎 Creating attachment [${index}]:`, attachment);
                return attachment;
            });
            
            console.log("📎 New attachments array:", newAttachments);
            setAttachments(prev => {
                const updated = [...prev, ...newAttachments];
                console.log("📋 Updated attachments state:", updated);
                console.log("📋 Updated attachments length:", updated.length);
                return updated;
            });
            toast.success(`${files.length} file(s) uploaded successfully`, { id: "upload" });
        } else {
            console.error("❌ No files returned from upload or empty array");
            console.error("❌ Upload response:", uploadedFiles);
            toast.error("Upload failed - no files returned", { id: "upload" });
        }
    } catch (error) {
        console.error("❌ Upload error:", error);
        console.error("❌ Upload error details:", JSON.stringify(error, null, 2));
        toast.error("Failed to upload files", { id: "upload" });
    } finally {
        setIsUploading(false);
        e.target.value = "";
    }
  };

  const fileInputRefs = {
    image: useRef<HTMLInputElement>(null),
    video: useRef<HTMLInputElement>(null),
    pdf: useRef<HTMLInputElement>(null),
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
    await createProject.mutateAsync({ 
      value: values.value,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  const [isFocused, setIsFocused] = useState(false);
  const isPending = createProject.isPending;
  const isButtonDisabled = isPending || !form.formState.isValid || isUploading;

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
          {/* File Attachments Preview - ABOVE textarea like Lovable */}
          {attachments.length > 0 && (
            <div className="mb-3 flex gap-2 flex-wrap" data-testid="attachments-preview">
              {/* Debug: Show attachment count */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-400 mb-1 w-full">
                  Debug: {attachments.length} attachment(s) loaded
                </div>
              )}
              {attachments.map((file, index) => {
                const isImage = file.type?.startsWith('image/') ?? false;
                const uniqueKey = `${file.url}-${index}`;
                
                console.log(`🎨 Rendering preview for [${index}]:`, {
                  name: file.name,
                  type: file.type,
                  url: file.url,
                  isImage
                });
                
                return (
                  <div key={uniqueKey} className="relative group">
                    {isImage ? (
                      <div 
                        className="relative rounded-lg overflow-hidden border-2 border-white/10 bg-gray-800"
                        style={{ width: '80px', height: '80px', position: 'relative' }}
                      >
                        {/* Using regular img tag for external UploadThing URLs - Next.js Image has issues with external domains */}
                        <img
                          src={file.url}
                          alt={file.name}
                          className="object-cover rounded-lg w-full h-full"
                          onError={(e) => {
                            console.error("❌ Image load error:", file.url, e);
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log("✅ Image loaded successfully:", file.url);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-all z-10"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="relative flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-white/10 bg-white/5 p-2"
                        style={{ width: '80px', height: '80px' }}
                      >
                        <FileTextIcon className="size-6 text-white/60" />
                        <span className="text-[10px] text-white/60 truncate w-full text-center px-1">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-all z-10"
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
            <div className="flex items-center gap-3">
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

              {/* File Upload Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isUploading || isPending}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full transition-all",
                      "h-8 w-8",
                      "bg-primary/20 hover:bg-primary/30 text-primary",
                      isUploading && "opacity-50 cursor-not-allowed"
                    )}
                    style={{
                      border: "1px solid rgba(59,130,246,0.3)",
                    }}
                  >
                    {isUploading ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <PlusIcon className="size-4" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
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