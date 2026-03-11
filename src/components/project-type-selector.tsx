// src/components/project-type-selector.tsx
"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ProjectType = "web" | "mobile";

interface ProjectTypeSelectorProps {
  value: ProjectType;
  onChange: (type: ProjectType) => void;
  disabled?: boolean;
}

export function ProjectTypeSelector({
  value,
  onChange,
  disabled = false,
}: ProjectTypeSelectorProps) {
  const options = [
    {
      value: "web" as const,
      label: "Web",
      subtitle: "for web development",
    },
    {
      value: "mobile" as const,
      label: "Mobile",
      subtitle: "for mobile development",
    },
  ];

  const selected = options.find((opt) => opt.value === value) || options[0];

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
          <span>{selected.label}</span>
          <ChevronDown style={{ width: "14px", height: "14px", opacity: 0.6 }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {options.map((option) => {
          const isSelected = option.value === value;
          
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onChange(option.value)}
              className={cn(
                "flex flex-col items-start gap-1 px-3 py-2.5 cursor-pointer",
                isSelected && "bg-accent"
              )}
            >
              <span className="font-medium text-sm">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.subtitle}
              </span>
            </DropdownMenuItem>
          );
        })}
        <div className="px-3 py-2 border-t border-border">
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            Choose one
            <ChevronDown className="size-3" />
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}