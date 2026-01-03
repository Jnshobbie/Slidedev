"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLinkIcon, RefreshCcwIcon, Smartphone, Copy, CheckIcon, QrCode, Loader2 } from "lucide-react";

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

// Snack's actual dark background color
const SNACK_BG = '#212121';

export function FragmentMobile({ data }: Props) {
  const [fragmentKey, setFragmentKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isCreatingSnack, setIsCreatingSnack] = useState(true);
  const [snackData, setSnackData] = useState<SnackResponse | null>(null);
  const [error, setError] = useState<string>("");

  // Extract files from fragment
  const files = useMemo(() => {
    return data.files && typeof data.files === 'object' 
      ? (data.files as Record<string, string>)
      : {};
  }, [data.files]);

  // Extract dependencies from fragment
  const dependencies = useMemo(() => {
    return data.dependencies && typeof data.dependencies === 'object'
      ? (data.dependencies as Record<string, string>)
      : {};
  }, [data.dependencies]);

  // Get App.tsx content
  const appCode = useMemo(() => {
    return files['App.tsx'] || files['App.js'] || '';
  }, [files]);

  // Create Snack via External Microservice
  useEffect(() => {
    if (!appCode) return;

    const createSnack = async () => {
      try {
        setIsCreatingSnack(true);
        setError("");

        console.log('📱 Calling Snack microservice...');

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

        console.log('✅ Snack created:', result);
        setSnackData(result);
      } catch (err) {
        console.error('❌ Failed to create Snack:', err);
        setError(err instanceof Error ? err.message : 'Failed to create preview');
      } finally {
        setIsCreatingSnack(false);
      }
    };

    createSnack();
  }, [appCode, files, data.title]);

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(appCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (isCreatingSnack) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white" style={{ backgroundColor: SNACK_BG }}>
        <Loader2 className="size-12 animate-spin text-blue-400 mb-4" />
        <p className="text-lg font-semibold">Creating Expo Snack...</p>
        <p className="text-sm text-zinc-400 mt-2">Uploading your mobile app</p>
      </div>
    );
  }

  // Error state
  if (error || !snackData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white" style={{ backgroundColor: SNACK_BG }}>
        <p className="text-lg font-semibold text-red-400">Unable to create preview</p>
        <p className="text-sm text-zinc-400 mt-2 max-w-md text-center">{error || 'Unknown error'}</p>
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

  // No code
  if (!appCode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white" style={{ backgroundColor: SNACK_BG }}>
        <Smartphone className="size-12 text-zinc-600 mb-4" />
        <p className="text-lg font-semibold text-zinc-400">No mobile code available</p>
        <p className="text-sm text-zinc-500 mt-2">Generate a mobile app to see the preview</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full" style={{ backgroundColor: SNACK_BG }}>
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-zinc-800" style={{ backgroundColor: SNACK_BG }}>
        <Hint text="Refresh Preview" side="bottom" align="start">
          <button
            onClick={onRefresh}
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-all shrink-0",
              "h-8 w-8 bg-zinc-800 hover:bg-zinc-700",
              "[&_svg]:size-4 [&_svg]:shrink-0"
            )}
          >
            <RefreshCcwIcon />
          </button>
        </Hint>

        <div className="flex items-center gap-2 flex-1 justify-center">
          <Smartphone className="size-4 text-blue-400" />
          <span className="text-sm text-zinc-400">iOS Preview • Expo Snack</span>
        </div>

        <Hint text={copied ? "Copied!" : "Copy Code"} side="bottom" align="end">
          <button
            onClick={handleCopy}
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-all shrink-0",
              "h-8 w-8 bg-zinc-800 hover:bg-zinc-700",
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
              "h-8 w-8 bg-zinc-800 hover:bg-zinc-700",
              "[&_svg]:size-4 [&_svg]:shrink-0"
            )}
          >
            <ExternalLinkIcon />
          </button>
        </Hint>
      </div>

      {/* Snack Embed - Centered Simulator Only */}
      <div className="flex-1 w-full overflow-hidden flex items-center justify-center relative" style={{ backgroundColor: SNACK_BG }}>
        {/* Container that clips the iframe to show only right side (simulator) */}
        <div 
          className="relative overflow-hidden"
          style={{ 
            width: '500px', 
            height: '100%',
            backgroundColor: SNACK_BG,
          }}
        >
          <iframe
            key={fragmentKey}
            src={snackData.embedUrl}
            style={{ 
              border: 'none',
              width: '1600px',
              height: '100%',
              marginLeft: '-1100px',
              transform: 'scale(1)',
            }}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-downloads"
            allow="clipboard-write; clipboard-read"
            title="Expo Snack Mobile Preview"
          />
        </div>
      </div>

      {/* Info Footer */}
      <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between" style={{ backgroundColor: SNACK_BG }}>
        <p className="text-xs text-zinc-500">
          
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <QrCode className="size-3" />
          <span>Scan QR inside preview to test on device</span>
        </div>
      </div>
    </div>
  );
}