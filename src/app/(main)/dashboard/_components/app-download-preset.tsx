"use client";

import { IconDeviceMobileDown } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AppDownloadErrors,
  type AppDownloadInput,
  type AppDownloadRule,
  buildAppDownloadPreset,
  detectAppStore,
} from "@/lib/core/geo-rules/app-download";

const FIELDS = [
  {
    key: "appStoreUrl",
    label: "App Store URL",
    hint: "iPhone and iPad visitors",
    placeholder: "https://apps.apple.com/app/id…",
  },
  {
    key: "playStoreUrl",
    label: "Google Play URL",
    hint: "Android visitors",
    placeholder: "https://play.google.com/store/apps/details?id=…",
  },
  {
    key: "fallbackUrl",
    label: "Website URL",
    hint: "Everyone else, and the link's destination",
    placeholder: "https://example.com",
  },
] satisfies { key: keyof AppDownloadInput; label: string; hint: string; placeholder: string }[];

const EMPTY_INPUT: AppDownloadInput = { appStoreUrl: "", playStoreUrl: "", fallbackUrl: "" };

// Starts from the link's current destination: a store link fills that store, anything else is
// the website.
function initialInput(destinationUrl: string): AppDownloadInput {
  const store = detectAppStore(destinationUrl);
  if (store === "appStore") return { ...EMPTY_INPUT, appStoreUrl: destinationUrl };
  if (store === "playStore") return { ...EMPTY_INPUT, playStoreUrl: destinationUrl };
  return { ...EMPTY_INPUT, fallbackUrl: destinationUrl };
}

export function AppDownloadPreset({
  destinationUrl,
  hasRoom,
  onApply,
}: {
  destinationUrl: string;
  // Whether the plan's rule limit leaves space for the two store rules.
  hasRoom: boolean;
  onApply: (preset: { destination: string; rules: AppDownloadRule[] }) => void;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState<AppDownloadInput>(EMPTY_INPUT);
  const [errors, setErrors] = useState<AppDownloadErrors>({});

  const open = () => {
    setInput(initialInput(destinationUrl.trim()));
    setErrors({});
    setIsOpen(true);
  };

  const apply = () => {
    const result = buildAppDownloadPreset(input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onApply(result);
    setIsOpen(false);
  };

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-border">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <IconDeviceMobileDown
            size={16}
            stroke={1.5}
            className="mt-0.5 shrink-0 text-neutral-400 dark:text-muted-foreground"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">
              App download link
            </p>
            <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
              Send iPhone visitors to the App Store, Android to Google Play, and everyone else to
              your website.
            </p>
          </div>
        </div>
        {!isOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={open}
            className="shrink-0 border-neutral-200 bg-white text-[13px] dark:border-border dark:bg-card"
          >
            Set up
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {FIELDS.map((field) => {
                const inputId = `${id}-${field.key}`;
                const error = errors[field.key];
                return (
                  <div key={field.key} className="space-y-1.5">
                    <label
                      htmlFor={inputId}
                      className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
                    >
                      {field.label}
                      <span className="font-normal text-neutral-400 dark:text-muted-foreground">
                        {field.hint}
                      </span>
                    </label>
                    <Input
                      id={inputId}
                      name={field.key}
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      value={input[field.key]}
                      onChange={(e) => {
                        setInput({ ...input, [field.key]: e.target.value });
                        if (error) setErrors({ ...errors, [field.key]: undefined });
                      }}
                      onKeyDown={(e) => {
                        // The preset sits inside the link form; Enter applies it instead of saving.
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        apply();
                      }}
                      placeholder={field.placeholder}
                      aria-invalid={!!error}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      className="h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card"
                    />
                    {error && (
                      <p id={`${inputId}-error`} className="text-[12px] text-red-500">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
                {!hasRoom && (
                  <p className="text-[12px] text-neutral-500 sm:mr-auto dark:text-neutral-400">
                    Needs 2 free rule slots. Remove a rule to continue.
                  </p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={apply}
                  disabled={!hasRoom}
                  className="bg-blue-600 text-[13px] text-white hover:bg-blue-700"
                >
                  Add 2 rules
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
