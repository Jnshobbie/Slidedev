import Link from "next/link"; 
import { CrownIcon, ZapIcon } from "lucide-react"; 
import { formatDuration, intervalToDuration } from "date-fns"; 
import { useMemo } from "react";

import { Button } from "@/components/ui/button";

import { useAuth } from "@clerk/nextjs";

interface Props {
    points: number;
    msBeforeNext: number; 
}

export const Usage = ({ points, msBeforeNext}: Props) => {
    const { has } = useAuth();
    const hasProAccess = has?.({ plan: "pro"});

    const resetTime = useMemo(() => {
        try{
            return formatDuration(
                intervalToDuration({
                    start: new Date(),
                    end: new Date(Date.now() + msBeforeNext),
                }),
                { format: ["months", "days", "hours"] }
            )
        } catch (error) {
            console.error("Error calculating reset time:", error);
            return "unknown"; 
        }
    }, [msBeforeNext]);
    
    return (
        <div className="rounded-t-xl px-4 py-3 bg-card dark:bg-sidebar border border-b-0 dark:border-transparent shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <ZapIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                        <p className="text-sm font-medium leading-none text-foreground">
                            {points} {hasProAccess ? "Pro" : "Free"} {points === 1 ? "Credit" : "Credits"}
                        </p>
                        <p className="text-xs text-muted-foreground leading-none">
                            Resets in{" "}{resetTime}
                        </p>
                    </div>
                </div>
                {!hasProAccess && (
                    <Button asChild size="sm" variant="cold">
                        <Link href="/pricing">
                            <CrownIcon />
                            <span>Upgrade</span>
                        </Link>
                    </Button>
                )}
            </div>
        </div>
    );
};