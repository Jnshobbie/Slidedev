import { useState } from "react";
import { ExternalLinkIcon, RefreshCcwIcon, CopyIcon, CheckIcon } from "lucide-react";

import { Fragment } from "@/generated/prisma";
import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";

interface Props {
    data: Fragment;
}

export function FragmentWeb({ data }: Props) {
    const [copied, setCopied] = useState(false);
    const [fragmentKey, setFragmentKey] = useState(0);

    const onRefresh = () => {
        setFragmentKey((prev) => prev + 1); 
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(data.sandboxUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); 
    };

    return (
        <div className="flex flex-col w-full h-full">
            <div className="px-3 py-2.5 flex items-center gap-2 border-b no-border-dark bg-background dark:bg-sidebar">
                <Hint text="Refresh" side="bottom" align="start">
                    <button
                        onClick={onRefresh}
                        className={cn(
                            "inline-flex items-center justify-center rounded-md transition-all shrink-0",
                            "h-8 w-8 bg-background shadow-sm",
                            "border no-border-dark dark:shadow-none",
                            "hover:bg-accent hover:text-accent-foreground active:scale-95",
                            "[&_svg]:size-4 [&_svg]:shrink-0"
                        )}
                    >
                        <RefreshCcwIcon />
                    </button>
                </Hint>
                
                <Hint text={copied ? "Copied!" : "Click to copy"} side="bottom">
                    <button 
                        onClick={handleCopy}
                        disabled={!data.sandboxUrl || copied}
                        className={cn(
                            "inline-flex items-center justify-start gap-2 rounded-md transition-all flex-1",
                            "h-8 px-3 text-sm font-normal bg-background shadow-sm",
                            "border no-border-dark dark:shadow-none",
                            "hover:bg-accent hover:text-accent-foreground active:scale-[0.99]",
                            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background",
                            "[&_svg]:size-3.5 [&_svg]:shrink-0"
                        )}
                    >
                        {copied ? (
                            <CheckIcon className="text-green-500" />
                        ) : (
                            <CopyIcon className="text-muted-foreground" />
                        )}
                        <span className="truncate text-muted-foreground text-xs">
                            {data.sandboxUrl}
                        </span>
                    </button>
                </Hint>
                
                <Hint text="Open in a new tab" side="bottom" align="end">
                    <button
                        disabled={!data.sandboxUrl}
                        onClick={() => {
                            if (!data.sandboxUrl) return;
                            window.open(data.sandboxUrl, "_blank");
                        }}
                        className={cn(
                            "inline-flex items-center justify-center rounded-md transition-all shrink-0",
                            "h-8 w-8 bg-background shadow-sm",
                            "border no-border-dark dark:shadow-none",
                            "hover:bg-accent hover:text-accent-foreground active:scale-95",
                            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background",
                            "[&_svg]:size-4 [&_svg]:shrink-0"
                        )}
                    >
                        <ExternalLinkIcon />
                    </button>
                </Hint>
            </div>
            <iframe 
              key={fragmentKey}
              className="h-full w-full"
              sandbox="allow-forms allow-scripts allow-same-origin"
              loading="lazy"
              src={data.sandboxUrl}
            />
        </div>
    )
}