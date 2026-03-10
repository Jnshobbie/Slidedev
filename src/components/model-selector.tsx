"use client";

import { cn } from "@/lib/utils";

const MODELS = [
  {
    id: "gpt-5.2",
    label: "GPT-5.2",
    description: "Fast & reliable",
    icon: "⚡",
  },
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    description: "Most powerful",
    icon: "✦",
  },
];

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-muted/50 p-0.5">
      {MODELS.map((model) => (
        <button
          key={model.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(model.id)}
          title={model.description}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
            value === model.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>{model.icon}</span>
          <span>{model.label}</span>
        </button>
      ))}
    </div>
  );
}