import { IconUpload } from "@tabler/icons-react";
import type React from "react";
import { useCallback, useState } from "react";

import { Input } from "@/components/ui/input";

interface LogoUploaderProps {
  setLogoImage: (image: string | null) => void;
}

export function LogoUploader({ setLogoImage }: LogoUploaderProps) {
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          setError("File size exceeds 2MB limit");
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoImage(reader.result as string);
          setError(null);
        };
        reader.onerror = () => {
          setError("Error reading file");
        };
        reader.readAsDataURL(file);
      }
    },
    [setLogoImage]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    []
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          setError("File size exceeds 2MB limit");
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoImage(reader.result as string);
          setError(null);
        };
        reader.onerror = () => {
          setError("Error reading file");
        };
        reader.readAsDataURL(file);
      }
    },
    [setLogoImage]
  );

  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-200 px-4 py-5 transition-colors hover:border-neutral-300 hover:bg-neutral-50/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <IconUpload size={20} stroke={1.5} className="text-neutral-400" />
      <div className="flex items-center gap-1 text-[13px]">
        <label
          htmlFor="logo-image"
          className="cursor-pointer font-medium text-blue-600 hover:text-blue-700"
        >
          Upload a file
          <Input
            id="logo-image"
            type="file"
            className="sr-only"
            onChange={handleFileUpload}
            accept="image/*"
          />
        </label>
        <span className="text-neutral-400">or drag and drop</span>
      </div>
      <p className="text-[11px] text-neutral-400">
        PNG, JPG, GIF up to 2MB
      </p>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

export default LogoUploader;
