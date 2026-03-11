"use client";

import { ChevronDown, LockIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const selectedModel = MODELS.find(m => m.id === value) || MODELS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          style={{
            backgroundColor: "rgba(39, 39, 42, 0.8)",
            border: "1px solid rgba(113, 113, 122, 0.5)",
            borderRadius: "8px",
            padding: "6px 10px",
            color: "#e4e4e7",
            fontSize: "12px",
            fontWeight: 500,
            transition: "all 0.2s ease",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            outline: "none",
            boxShadow: "none",
          }}
          className="inline-flex items-center gap-1.5"
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = "rgba(63, 63, 70, 0.8)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(39, 39, 42, 0.8)";
          }}
        >
          <span>{selectedModel.icon}</span>
          <span>{selectedModel.label}</span>
          <ChevronDown style={{ width: "14px", height: "14px", opacity: 0.6 }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {MODELS.map(model => {
          const isLocked = model.proOnly && !isPro; //const isLocked = false; for testing pro mode 
          const isSelected = value === model.id;

          return (
            <DropdownMenuItem
              key={model.id}
              onSelect={() => {
                if (isLocked) {
                  router.push("/pricing");
                } else {
                  onChange(model.id);
                }
              }}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 cursor-pointer",
                isSelected && "bg-accent",
                isLocked && "cursor-pointer"
              )}
            >
              <div className="flex items-center gap-2">
                <span>{model.icon}</span>
                <span className="font-medium text-sm">{model.label}</span>
              </div>
              {isLocked ? (
                <span className="flex items-center gap-1 text-[10px] text-blue-400 font-medium">
                  <LockIcon className="size-3" />
                  Upgrade
                </span>
              ) : isSelected ? (
                <span className="text-[10px] text-muted-foreground">Active</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}