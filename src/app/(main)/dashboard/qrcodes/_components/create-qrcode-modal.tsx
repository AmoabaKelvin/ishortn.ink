"use client";

import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { revalidateRoute } from "../../revalidate-homepage";

export function CreateQRCodeModal() {
  const [open, setOpen] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [selectedLink, setSelectedLink] = useState<{
    id: number;
    alias: string;
    domain: string;
    url: string;
  } | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

  const router = useRouter();

  const { data: linksData, isLoading: isLoadingLinks } = api.link.list.useQuery(
    {
      page: 1,
      pageSize: 50,
      search: debouncedSearch,
    },
    {
      enabled: open && !isStandalone,
    }
  );

  const createQrMutation = api.qrCode.create.useMutation({
    onSuccess: async () => {
      toast.success("QR Code created successfully");
      setOpen(false);
      setSelectedLink(null);
      setIsStandalone(false);
      await revalidateRoute("/dashboard/qrcodes");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = async () => {
    if (!isStandalone && !selectedLink) {
      toast.error("Please select a link");
      return;
    }

    // For standalone, we might want to generate a random string or let user input content?
    // The requirement says: "Also include a toggle to create a standalone (random) QR code not linked to any URL."
    // "When toggled ON, an info label should appear: 'Standalone QR codes have no analytics tracking.'"
    // It implies it's random or maybe we should ask for content?
    // "Standalone (random)" implies random content? Or maybe just a random ID?
    // Usually standalone QR codes are for text, wifi, vcard etc.
    // But here it says "random".
    // I'll assume it generates a random string if no content is provided, or maybe we should let them input text?
    // But the prompt says "random".
    // Let's assume it's just a random ID for now, or maybe a placeholder.
    // Wait, if it's random, what's the point? Maybe it's for testing?
    // Or maybe it means "Custom content"?
    // "Standalone (random) QR code not linked to any URL"
    // I'll generate a random string for now.

    // Actually, `qrcode.service.ts` expects `content`.
    // If standalone, I'll generate a random string.
    
    // Wait, `qrcode.service.ts` expects `qrCodeBase64`.
    // I need to generate the QR code here on the client.
    
    // I need to import `qrcode` here?
    // Or use a library.
    // Since I added `qrcode` to package.json (it was there), I can use it.
    // But `qrcode` is a node library. `qrcode.react` is for react.
    // I can use `qrcode` in the browser too usually.
    
    // Let's dynamic import `qrcode` to avoid SSR issues if any.
    
    const QRCode = (await import("qrcode")).default;
    
    let content = "";
    let title = "";
    
    if (isStandalone) {
      // Generate random string
      content = Math.random().toString(36).substring(2, 15);
      title = "Standalone QR Code";
    } else {
      content = `https://${selectedLink!.domain}/${selectedLink!.alias}`;
      title = selectedLink!.alias; // Or link name?
    }

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(content, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 1024,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      await createQrMutation.mutateAsync({
        title,
        content,
        qrCodeBase64: qrCodeDataUrl,
        wasShortened: !isStandalone,
        selectedColor: "#000000",
        cornerStyle: "square",
        patternStyle: "square",
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate QR code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create QR Code</DialogTitle>
          <DialogDescription>
            Create a QR code for your links or a standalone one.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="standalone-mode" className="flex flex-col gap-1">
              <span>Standalone QR Code</span>
              <span className="font-normal text-xs text-muted-foreground">
                Generate a random QR code not linked to any URL.
              </span>
            </Label>
            <Switch
              id="standalone-mode"
              checked={isStandalone}
              onCheckedChange={setIsStandalone}
            />
          </div>

          {isStandalone && (
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Standalone QR codes have no analytics tracking.
            </div>
          )}

          {!isStandalone && (
            <div className="grid gap-2">
              <Label>Select Link</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {selectedLink
                      ? `${selectedLink.domain}/${selectedLink.alias}`
                      : "Select a link..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search links..."
                      value={search}
                      onValueChange={setSearch}
                    />
                    <CommandList>
                      {isLoadingLinks && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          Loading links...
                        </div>
                      )}
                      {!isLoadingLinks && linksData?.links.length === 0 && (
                        <CommandEmpty>No links found.</CommandEmpty>
                      )}
                      {!isLoadingLinks &&
                        linksData?.links.map((link) => (
                          <CommandItem
                            key={link.id}
                            value={String(link.id)}
                            onSelect={() => {
                              setSelectedLink({
                                id: link.id,
                                alias: link.alias!,
                                domain: link.domain,
                                url: link.url!,
                              });
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedLink?.id === link.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {link.domain}/{link.alias}
                              </span>
                              <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                {link.url}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={createQrMutation.isLoading || (!isStandalone && !selectedLink)}
          >
            {createQrMutation.isLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create QR Code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
