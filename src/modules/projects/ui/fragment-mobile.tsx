"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLinkIcon, RefreshCcwIcon, Smartphone, Copy, CheckIcon, QrCode, Loader2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";

import { Fragment } from "@/generated/prisma";
import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";

interface Props {
  data: Fragment;
}

interface SnackResponse {
  success: boolean;
  snackId?: string;
  snackUrl?: string;
  embedUrl?: string;
  qrUrl?: string;
  error?: string;
}

export function FragmentMobile({ data }: Props) {
  const [fragmentKey, setFragmentKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isCreatingSnack, setIsCreatingSnack] = useState(true);
  const [snackData, setSnackData] = useState<SnackResponse | null>(null);
  const [error, setError] = useState<string>("");
  
  // Positioning controls
  const [marginLeft, setMarginLeft] = useState(-1130);
  const [marginTop, setMarginTop] = useState(-30);
  const [showControls, setShowControls] = useState(false);

  const files = useMemo(() => {
    return data.files && typeof data.files === 'object' 
      ? (data.files as Record<string, string>)
      : {};
  }, [data.files]);

  const dependencies = useMemo(() => {
    return data.dependencies && typeof data.dependencies === 'object'
      ? (data.dependencies as Record<string, string>)
      : {};
  }, [data.dependencies]);

  const appCode = useMemo(() => {
    return files['App.tsx'] || files['App.js'] || '';
  }, [files]);

  useEffect(() => {
    if (!appCode) return;

    const createSnack = async () => {
      try {
        setIsCreatingSnack(true);
        setError("");

        const response = await fetch('https://slidedev-snack-service.vercel.app/api/create-snack', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files,
            name: data.title || 'Mobile App',
            dependencies,
          }),
        });

        const result: SnackResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to create Snack');
        }

        setSnackData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create preview');
      } finally {
        setIsCreatingSnack(false);
      }
    };

    createSnack();
  }, [appCode, files, data.title, dependencies]);

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(appCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isCreatingSnack) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-foreground">
        <Loader2 className="size-12 animate-spin text-blue-400 mb-4" />
        <p className="text-lg font-semibold">Creating Expo Snack...</p>
        <p className="text-sm text-muted-foreground mt-2">Uploading your mobile app</p>
      </div>
    );
  }

  if (error || !snackData) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-foreground">
        <p className="text-lg font-semibold text-red-400">Unable to create preview</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">{error || 'Unknown error'}</p>
        <button
          onClick={handleCopy}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <Copy className="size-4" />
          Copy Code
        </button>
      </div>
    );
  }

  if (!appCode) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-foreground">
        <Smartphone className="size-12 text-muted-foreground mb-4" />
        <p className="text-lg font-semibold text-muted-foreground">No mobile code available</p>
        <p className="text-sm text-muted-foreground mt-2">Generate a mobile app to see the preview</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-background">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-border bg-background">
        <Hint text="Refresh Preview" side="bottom" align="start">
          <button
            onClick={onRefresh}
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-all shrink-0",
              "h-8 w-8 bg-secondary hover:bg-secondary/80",
              "[&_svg]:size-4 [&_svg]:shrink-0"
            )}
          >
            <RefreshCcwIcon />
          </button>
        </Hint>

        <div className="flex items-center gap-2 flex-1 justify-center">
          <Smartphone className="size-4 text-blue-400" />
          <span className="text-sm text-muted-foreground">iOS Preview • Expo Snack</span>
        </div>

        <Hint text={copied ? "Copied!" : "Copy Code"} side="bottom" align="end">
          <button
            onClick={handleCopy}
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-all shrink-0",
              "h-8 w-8 bg-secondary hover:bg-secondary/80",
              "[&_svg]:size-4 [&_svg]:shrink-0"
            )}
          >
            {copied ? <CheckIcon className="text-green-400" /> : <Copy />}
          </button>
        </Hint>

        <Hint text="Open in New Tab" side="bottom" align="end">
          <button
            onClick={() => window.open(snackData.snackUrl, "_blank")}
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-all shrink-0",
              "h-8 w-8 bg-secondary hover:bg-secondary/80",
              "[&_svg]:size-4 [&_svg]:shrink-0"
            )}
          >
            <ExternalLinkIcon />
          </button>
        </Hint>
      </div>

      {/* Snack Embed */}
      <div className="flex-1 w-full overflow-hidden flex items-center justify-center relative bg-background">
        <div 
          className="relative overflow-hidden"
          style={{ 
            width: '420px',
            height: '850px',
          }}
        >
          <iframe
            key={fragmentKey}
            src={snackData.embedUrl}
            style={{ 
              border: 'none',
              width: '1600px',
              height: '1000px',
              marginLeft: `${marginLeft}px`,
              marginTop: `${marginTop}px`,
              transform: 'scale(1)',
            }}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-downloads"
            allow="clipboard-write; clipboard-read"
            title="Expo Snack Mobile Preview"
          />
        </div>

        {/* Debug Position Controls - Remove after finding perfect values */}
        <button
          onClick={() => setShowControls(!showControls)}
          className="absolute top-4 right-4 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
        >
          {showControls ? 'Hide' : 'Adjust Position'}
        </button>

        {showControls && (
          <div className="absolute top-16 right-4 bg-background border border-border rounded-lg p-4 shadow-lg">
            <p className="text-xs font-semibold mb-2">Position Controls</p>
            
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Horizontal (marginLeft: {marginLeft})</p>
                <div className="flex gap-2">
                  <button onClick={() => setMarginLeft(m => m - 10)} className="p-2 bg-secondary rounded hover:bg-secondary/80">
                    <ChevronLeft className="size-4" />
                  </button>
                  <button onClick={() => setMarginLeft(m => m + 10)} className="p-2 bg-secondary rounded hover:bg-secondary/80">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Vertical (marginTop: {marginTop})</p>
                <div className="flex gap-2">
                  <button onClick={() => setMarginTop(m => m - 10)} className="p-2 bg-secondary rounded hover:bg-secondary/80">
                    <ChevronUp className="size-4" />
                  </button>
                  <button onClick={() => setMarginTop(m => m + 10)} className="p-2 bg-secondary rounded hover:bg-secondary/80">
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-xs font-mono bg-secondary p-2 rounded">
                  marginLeft: {marginLeft}px<br/>
                  marginTop: {marginTop}px
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="px-4 py-2 border-t border-border bg-background flex items-center justify-between">
        <p className="text-xs text-muted-foreground"></p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <QrCode className="size-3" />
          <span>Scan QR inside preview to test on device</span>
        </div>
      </div>
    </div>
  );
}