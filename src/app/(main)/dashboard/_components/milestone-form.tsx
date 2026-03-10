"use client";

import { IconX } from "@tabler/icons-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";

const PRESET_MILESTONES = [100, 250, 500, 1000, 5000, 10000];

export type MilestoneEntry = {
  threshold: number;
  notifiedAt: Date | null;
};

type MilestoneEditorProps = {
  milestones: MilestoneEntry[];
  onChange: (milestones: MilestoneEntry[]) => void;
  disabled?: boolean;
};

export function MilestoneEditor({ milestones, onChange, disabled }: MilestoneEditorProps) {
  const [milestoneInput, setMilestoneInput] = useState("");

  const currentThresholds = milestones.map((m) => m.threshold);
  const notifiedSet = new Set(
    milestones.filter((m) => m.notifiedAt !== null).map((m) => m.threshold),
  );

  const addThreshold = (value: number) => {
    if (disabled || currentThresholds.includes(value)) return;
    const updated = [...milestones, { threshold: value, notifiedAt: null }]
      .sort((a, b) => a.threshold - b.threshold);
    onChange(updated);
  };

  const removeThreshold = (value: number) => {
    if (disabled) return;
    onChange(milestones.filter((m) => m.threshold !== value));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = parseInt(milestoneInput, 10);
      if (!value || value <= 0) return;
      addThreshold(value);
      setMilestoneInput("");
    }
  };

  return (
    <div className="space-y-3">
      {/* Active milestones */}
      {currentThresholds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currentThresholds.map((threshold) => (
            <span
              key={threshold}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                notifiedSet.has(threshold)
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              {threshold.toLocaleString()}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeThreshold(threshold)}
                  className="ml-0.5 rounded-full p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <IconX size={10} stroke={2} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_MILESTONES.filter((p) => !currentThresholds.includes(p)).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => addThreshold(preset)}
            disabled={disabled}
            className="rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-[12px] text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +{preset.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <Input
        type="number"
        placeholder="Custom threshold (press Enter)"
        value={milestoneInput}
        onChange={(e) => setMilestoneInput(e.target.value)}
        onKeyDown={handleInputKeyDown}
        disabled={disabled}
        className="h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
      />
    </div>
  );
}
