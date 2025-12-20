"use client";

import { format } from "date-fns"; 
import Image from "next/image";

import { Fragment, MessageRole, MessageType } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import { ChevronRightIcon, Code2Icon, FileIcon, VideoIcon } from "lucide-react";

interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface UserMessageProps {
    content: string;
    attachments?: FileAttachment[];
}

const UserMessage = ({ content, attachments }: UserMessageProps) => {
    return (
        <div className="flex justify-end pb-4 pr-2 pl-10"> 
          <div className="rounded-lg bg-muted p-3 border border-transparent dark:border-transparent shadow-none max-w-[80%] break-words space-y-2">
            {/* Display attachments */}
            {attachments && attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {attachments.map((file, index) => {
                        const isImage = file.type.startsWith('image/');
                        const isVideo = file.type.startsWith('video/');
                        
                        return (
                            <div key={index} className="relative">
                                {isImage && (
                                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                                        <Image
                                            src={file.url}
                                            alt={file.name}
                                            width={200}
                                            height={200}
                                            className="rounded-md object-cover max-h-48 hover:opacity-80 transition-opacity"
                                        />
                                    </a>
                                )}
                                {isVideo && (
                                    <div className="flex items-center gap-2 bg-background/50 rounded-md px-3 py-2">
                                        <VideoIcon className="size-4" />
                                        <a 
                                            href={file.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-sm hover:underline truncate max-w-[150px]"
                                        >
                                            {file.name}
                                        </a>
                                    </div>
                                )}
                                {!isImage && !isVideo && (
                                    <div className="flex items-center gap-2 bg-background/50 rounded-md px-3 py-2">
                                        <FileIcon className="size-4" />
                                        <a 
                                            href={file.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-sm hover:underline truncate max-w-[150px]"
                                        >
                                            {file.name}
                                        </a>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Display text content */}
            <div>{content}</div>
          </div>
        </div>
    )
}

interface FragmentCardProps {
    fragment: Fragment;
    isActiveFragment: boolean;
    onFragmentClick: (fragment: Fragment) => void;
}

const FragmentCard = ({
    fragment,
    isActiveFragment,
    onFragmentClick,
}: FragmentCardProps) => {
    return (
        <button
        className={cn(
            "flex items-start text-start gap-2 rounded-lg bg-muted w-fit p-3 transition-colors",
            "border no-border-dark hover:bg-secondary",
            isActiveFragment &&
              "bg-primary text-primary-foreground border-primary hover:bg-primary",
        )}
        onClick={() => onFragmentClick(fragment)}
    >
        <Code2Icon className="size-4 mt-0.5" />
        <div className="flex flex-col flex-1">
            <span className="text-sm font-medium line-clamp-1">
                {fragment.title}
            </span>
            <span className="text-sm">
                Preview
            </span>
        </div>    
        <div className="flex items-center justify-center mt-0.5">
            <ChevronRightIcon className="size-4"/>
        </div>
        </button>
    );
};

interface AssistantMessageProps {
    content: string;
    fragment: Fragment | null; 
    createdAt: Date;
    isActiveFragment: boolean;
    onFragmentClick: (fragment: Fragment) => void;
    type: MessageType;
}

const AssistantMessage =({
    content,
    fragment,
    createdAt,
    isActiveFragment,
    onFragmentClick,
    type,
}: AssistantMessageProps) => {
    return (
        <div className={cn(
            "flex flex-col group px-2 pb-4", 
            type === "ERROR" && "text-red-700 dark:text-red-500", 
        )}>
            <div className="flex items-center gap-2 pl-2 mb-2">
                {/* add Logo */}
                <span className="text-sm font-medium">Slide</span>
                <span className="text-xs text-muted-foreground opacity-0 transition-opacity
                group-hover:opacity-100">
                    {format(createdAt, "HH:mm 'on' MMM dd, yyyy")}
                </span>
            </div>
            <div className="pl-8.5 flex flex-col gap-y-4">
                <span>{content}</span>
                {fragment && type === "RESULT" && (
                    <FragmentCard
                    fragment={fragment}
                    isActiveFragment={isActiveFragment}
                    onFragmentClick={onFragmentClick} 
                    />
                )}
            </div>
        </div>
    )
};

interface MessageCardProps {
    content: string;
    role: MessageRole;
    fragment: Fragment | null; 
    createdAt: Date;
    isActiveFragment: boolean;
    onFragmentClick: (fragment: Fragment) => void;
    type: MessageType;
    attachments?: FileAttachment[];
}

export const MessageCard =({
    content,
    role,
    fragment,
    createdAt,
    isActiveFragment,
    onFragmentClick,
    type,
    attachments,
}: MessageCardProps) => {
    if (role === "ASSISTANT") {
        return (
           <AssistantMessage
             content={content}
             fragment={fragment}
             createdAt={createdAt}
             isActiveFragment={isActiveFragment}
             onFragmentClick={onFragmentClick}
             type={type}
           />
        )
    }

    return (
        <UserMessage content={content} attachments={attachments} />
    );
};