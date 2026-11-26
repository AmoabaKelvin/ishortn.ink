import { IconUpload } from "@tabler/icons-react";
import { useCallback, useState } from "react";

import type React from "react";

interface LogoUploaderProps {
  setLogoImage: (image: string | null) => void;
}

export function LogoUploader({ setLogoImage }: LogoUploaderProps) {
  const [error, setError] = useState<string | null>(null);

  const loadLogoFile = useCallback(
    (file: File) => {
      // `accept` only filters the picker; dropped files arrive unchecked.
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError("File size exceeds 2MB limit");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        // SAFETY: readAsDataURL always yields a string result on load.
        setLogoImage(reader.result as string);
        setError(null);
      };
      reader.onerror = () => {
        setError("Error reading file");
      };
      reader.readAsDataURL(file);
    },
    [setLogoImage],
  );

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) loadLogoFile(file);
    },
    [loadLogoFile],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) loadLogoFile(file);
    },
    [loadLogoFile],
  );

  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-200 px-4 py-5 transition-colors hover:border-neutral-300 hover:bg-neutral-50/50 dark:border-border dark:hover:border-neutral-600 dark:hover:bg-accent/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <IconUpload size={20} stroke={1.5} className="text-neutral-400 dark:text-muted-foreground" />
      <div className="flex items-center gap-1 text-[13px]">
        <label
          htmlFor="logo-image"
          className="cursor-pointer font-medium text-blue-600 hover:text-blue-700 focus-within:underline dark:text-blue-400"
        >
          Upload a file
          {/* A plain input: the shadcn Input's w-full beats sr-only and widened the page. */}
          <input
            id="logo-image"
            type="file"
            className="sr-only"
            onChange={handleFileUpload}
            accept="image/*"
          />
        </label>
        <span className="text-neutral-400 dark:text-muted-foreground">or drag and drop</span>
      </div>
      <p className="text-[11px] text-neutral-400 dark:text-muted-foreground">
        PNG, JPG, GIF up to 2MB
      </p>
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

export default LogoUploader;
