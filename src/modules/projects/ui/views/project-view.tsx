"use client";

import { Suspense, useState } from "react";

import { Fragment } from "@/generated/prisma"; 

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"; 
import { MessagesContainer } from "../components/messages-container";
import { ProjectHeader } from "../components/project-header";
import { FragmentWeb } from "../components/fragment-web"; 
import { EyeIcon, CodeIcon, CrownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileExplorer } from "@/components/file-explorer";
import { UserControl } from "@/components/user-control";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
 

interface Props {
    projectId: string; 
}

export const ProjectView = ({ projectId }: Props) => {
  const { has } = useAuth();
  const hasProAccess = has?.({ plan: "pro"});

  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");

  return (
    <div className="h-screen bg-background">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel
            defaultSize={35}
            minSize={20}
            className="flex flex-col min-h-0"
          >
            <Suspense fallback={<p>Loading project...</p>}>
              <ProjectHeader projectId={projectId}/>
            </Suspense>
            <Suspense fallback={<p>Loading messages...</p>}>
              <MessagesContainer 
                projectId={projectId} 
                activeFragment={activeFragment}
                setActiveFragment={setActiveFragment}
              />
            </Suspense> 
          </ResizablePanel>
          
          <ResizableHandle className="hover:bg-primary transition-colors" />
          
          <ResizablePanel
            defaultSize={65}
            minSize={50}
            className="flex flex-col"
          >
            {/* Header with custom tab buttons */}
            <div className="w-full flex items-center p-2 gap-x-2 border-b no-border-dark bg-background">
              {/* Custom Tab Buttons */}
              <div className="inline-flex h-8 items-center justify-center rounded-md bg-muted p-1 gap-1">
                <button
                  onClick={() => setActiveTab("preview")}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200",
                    "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
                    activeTab === "preview"
                      ? "bg-background text-foreground shadow-sm opacity-100"
                      : "text-muted-foreground opacity-60 hover:opacity-80 hover:bg-background/30"
                  )}
                >
                  <EyeIcon /> <span>Demo</span>
                </button>
                <button
                  onClick={() => setActiveTab("code")}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200",
                    "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
                    activeTab === "code"
                      ? "bg-background text-foreground shadow-sm opacity-100"
                      : "text-muted-foreground opacity-60 hover:opacity-80 hover:bg-background/30"
                  )}
                >
                  <CodeIcon /> <span>Code</span>
                </button>
              </div>
              
              <div className="ml-auto flex items-center gap-x-2">
                {!hasProAccess && (
                  <Button asChild size="sm" variant="cold">
                    <Link href="/pricing">
                      <CrownIcon /> Upgrade
                    </Link>
                  </Button>
                )}
                <UserControl />
              </div>
            </div>
            
            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* Preview Tab */}
              {activeTab === "preview" && (
                <div className="h-full w-full">
                  {!!activeFragment && <FragmentWeb data={activeFragment} />}
                  {!activeFragment && (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p className="text-sm">No preview available</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Code Tab */}
              {activeTab === "code" && (
                <div className="h-full w-full">
                  {!!activeFragment?.files && (
                    <FileExplorer 
                      files={activeFragment.files as { [path: string]: string}}
                    />
                  )}
                  {!activeFragment?.files && (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p className="text-sm">No code available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
    </div> 
  );
};