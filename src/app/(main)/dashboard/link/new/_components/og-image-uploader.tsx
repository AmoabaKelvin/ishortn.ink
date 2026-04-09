"use client";

import type React from "react";
import { useRef, useState } from "react";
import { IconPhotoPlus, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

interface OgImageUploaderProps {
  value?: string;
  onChange: (image: string | undefined) => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export function OgImageUploader({ value, onChange }: OgImageUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBase64 = value?.startsWith("data:");

  const handleFileUpload = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setError("File size exceeds 2MB limit");
      return;
    }

    if (!file.type.match(/^image\/(png|jpe?g|gif)$/)) {
      setError("Only PNG, JPG, and GIF files are supported");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onChange(reader.result as string);
      setError(null);
    };
    reader.onerror = () => {
      setError("Error reading file");
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input so the same file can be selected again
    event.target.value = "";
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value || undefined);
    setError(null);
  };

  const handleClear = () => {
    onChange(undefined);
    setError(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Show preview when there's an uploaded image
  if (isBase64 && value) {
    return (
      <div className="space-y-2">
        <div className="group relative overflow-hidden rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50">
          <img
            src={value}
            alt="OG Preview"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              onClick={handleClear}
            >
              <IconX size={14} stroke={1.5} className="mr-1" />
              Remove
            </Button>
          </div>
        </div>
        {error && <p className="text-[12px] text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex h-9 w-full items-center overflow-hidden rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card transition-colors hover:border-neutral-300 dark:hover:border-neutral-500 focus-within:border-neutral-300 dark:focus-within:border-ring focus-within:ring-1 focus-within:ring-neutral-300 dark:focus-within:ring-ring/20">
        <input
          type="url"
          placeholder="https://example.com/image.jpg"
          value={value || ""}
          onChange={handleUrlChange}
          className="h-full flex-1 border-0 bg-transparent px-3 text-[13px] font-medium text-neutral-900 dark:text-foreground placeholder:text-neutral-400 focus:outline-none"
        />
        <div className="flex h-full items-center border-l border-neutral-200 dark:border-border px-1">
          <button
            type="button"
            onClick={handleUploadClick}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            <IconPhotoPlus size={14} stroke={1.5} />
            <span>Upload</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={handleFileInputChange}
          accept="image/png,image/jpeg,image/gif"
          aria-label="Upload OG image"
        />
      </div>

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      {/* URL preview */}
      {value && !isBase64 && (
        <div className="group relative overflow-hidden rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50">
          <img
            src={value}
            alt="OG Preview"
            className="aspect-video w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
    </div>
  );
}

export default OgImageUploader;
