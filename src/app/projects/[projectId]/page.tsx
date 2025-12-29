import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary"; 

import { getQueryClient, trpc } from "@/trpc/server";
import { ProjectView } from "@/modules/projects/ui/views/project-view";
import { prisma } from "@/lib/db";

interface Props {
    params: Promise<{
        projectId: string;
    }>
};

const Page = async ({ params }: Props) => {
    const { projectId } = await params; 

    const queryClient = getQueryClient(); 
    void queryClient.prefetchQuery(trpc.messages.getMany.queryOptions({
        projectId,
    }));

    void queryClient.prefetchQuery(trpc.projects.getOne.queryOptions({
        id: projectId,
    }));

    // NEW: Fetch project to get projectType
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { projectType: true }
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ErrorBoundary fallback={<p>Error!</p>}>
            <Suspense fallback={<p>Loading...</p>}>
           <ProjectView 
                projectId={projectId}
                projectType={(project?.projectType as "web" | "mobile") || "web"}
           />
           </Suspense>
           </ErrorBoundary>
        </HydrationBoundary>
    );
}

export default Page;