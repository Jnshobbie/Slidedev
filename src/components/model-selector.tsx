"use client";

import { cn } from "@/lib/utils";
import { ChevronDownIcon, LockIcon } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const MODELS = [
  {
    id: "gpt-5.2",
    label: "GPT-5.2",
    icon: "⚡",
    proOnly: false,
  },
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    icon: "✦",
    proOnly: true,
  },
];

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  isPro?: boolean;
}

export function ModelSelector({ value, onChange, disabled, isPro }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedModel = MODELS.find(m => m.id === value) || MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all",
          "border border-border bg-muted/50 hover:bg-muted text-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span>{selectedModel.icon}</span>
        <span>{selectedModel.label}</span>
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute bottom-full mb-2 left-0 z-20 w-52 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
            {MODELS.map(model => {
              const isLocked = model.proOnly && !isPro;
              const isSelected = value === model.id;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    if (!isLocked) {
                      onChange(model.id);
                      setOpen(false);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-sm transition-all",
                    isSelected && "bg-muted",
                    !isLocked && !isSelected && "hover:bg-muted/60",
                    isLocked && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{model.icon}</span>
                    <span className="font-medium">{model.label}</span>
                  </div>
                  {isLocked ? (
                    <Link
                      href="/pricing"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-medium"
                    >
                      <LockIcon className="size-3" />
                      Upgrade
                    </Link>
                  ) : isSelected ? (
                    <span className="text-[10px] text-muted-foreground">Active</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}