"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

const MAX_SLUG_LENGTH = 100;

export function CreateBioPageDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");

  const create = api.bioPage.create.useMutation({
    onSuccess: (res) => {
      toast.success("Bio page created.");
      setOpen(false);
      router.push(`/dashboard/bio-pages/${res.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  // Mirror the server's slug constraint (3–100 chars) to avoid failed submissions.
  const canCreate =
    normalizedSlug.length >= 3 && normalizedSlug.length <= MAX_SLUG_LENGTH && !create.isLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New bio page</DialogTitle>
          <DialogDescription>
            Pick a handle for your bio page. You can change it later.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bio-slug">Handle</Label>
            <div className="flex h-9 items-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-border dark:bg-card dark:shadow-none">
              <span className="flex h-full select-none items-center border-r border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-500 dark:border-border dark:bg-muted dark:text-gray-400">
                ishortn.ink/p/
              </span>
              <input
                id="bio-slug"
                value={normalizedSlug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="yourname"
                maxLength={MAX_SLUG_LENGTH}
                className="h-full flex-1 bg-transparent px-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-500 dark:text-foreground dark:placeholder:text-gray-400"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio-title">Title (optional)</Label>
            <Input
              id="bio-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            onClick={() => create.mutate({ slug: normalizedSlug, title: title.trim() || undefined })}
            disabled={!canCreate}
          >
            {create.isLoading ? "Creating…" : "Create page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
