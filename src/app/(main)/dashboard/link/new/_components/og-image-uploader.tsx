"use client";

import type React from "react";
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

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
        <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
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
              <X className="mr-1 h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex h-9 w-full items-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 hover:border-gray-300">
        <input
          type="url"
          placeholder="https://example.com/image.jpg"
          value={value || ""}
          onChange={handleUrlChange}
          className="h-full flex-1 border-0 bg-transparent px-3 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none"
        />
        <div className="flex h-full items-center border-l border-gray-200 px-1">
          <button
            type="button"
            onClick={handleUploadClick}
            className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <ImagePlus className="h-4 w-4" />
            <span>Upload</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={handleFileInputChange}
          accept="image/png,image/jpeg,image/gif"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* URL preview */}
      {value && !isBase64 && (
        <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
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
