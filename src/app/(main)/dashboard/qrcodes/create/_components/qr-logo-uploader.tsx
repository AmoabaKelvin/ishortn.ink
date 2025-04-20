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
    <div>
      <h2 className="mb-2 mt-6 text-lg">Add a logo</h2>
      <div
        className="mt-1 flex justify-center rounded-md border-2 border-dashed border-input px-6 pb-6 pt-5"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="space-y-1 text-center">
          <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <div className="flex text-sm text-muted-foreground">
            <label
              htmlFor="image"
              className="relative cursor-pointer rounded-md bg-background font-medium text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:text-primary-foreground"
            >
              <span>Upload a file</span>
              <Input
                id="image"
                type="file"
                className="sr-only"
                onChange={handleFileUpload}
                accept="image/*"
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, GIF up to 2MB
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default LogoUploader;

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Upload</title>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}
