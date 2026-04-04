"use client"

import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Trash2 } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@clerk/nextjs";

export const ProjectsList = () => {
    const trpc = useTRPC();
    const { user } = useUser();
    const queryClient = useQueryClient();
    const { data: projects } = useQuery(trpc.projects.getMany.queryOptions());

    const deleteMutation = useMutation(
      trpc.projects.delete.mutationOptions({
        onSuccess: () => {
          queryClient.invalidateQueries(trpc.projects.getMany.queryOptions());
        },
      })
    );

    if (!user) return null;

    return (
        <div className="w-full bg-white dark:bg-sidebar rounded-xl p-8 border flex flex-col gap-y-6 sm:gap-y-4">
            <h2 className="text-2xl font-semibold">
                {user?.firstName}&apos;s Saved Projects
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {projects?.length === 0 && (
                    <div className="col-span-full text-center">
                        <p className="text-sm text-muted-foreground">
                            No projects found
                        </p>
                    </div>
                )}
                {projects?.map((project) => (
                    <div key={project.id} className="relative group">
                        <Button
                            variant="outline"
                            className="font-normal h-auto justify-start w-full text-start p-4"
                            asChild
                        >
                            <Link href={`/projects/${project.id}`}>
                                <div className="flex items-center gap-x-4">
                                    <Image
                                        src="/logo.png"
                                        alt="Slide"
                                        width={32}
                                        height={32}
                                        className="object-contain"
                                    />
                                    <div className="flex flex-col">
                                        <h3 className="truncate font-medium">
                                            {project.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {formatDistanceToNow(project.updatedAt, {
                                                addSuffix: true,
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.preventDefault()}
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={() => deleteMutation.mutate({ id: project.id })}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete project
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
            </div>
        </div>
    )
}