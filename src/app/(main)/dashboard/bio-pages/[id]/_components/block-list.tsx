"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconAlignLeft,
  IconBrandWhatsapp,
  IconEye,
  IconEyeOff,
  IconGripVertical,
  IconHeading,
  IconLine,
  IconLink,
  IconMail,
  IconPencil,
  IconTrash,
  IconWorld,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { WHATSAPP_DEFAULT_LABEL } from "@/components/bio/whatsapp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/react";

import { BlockFormDialog } from "./block-form-dialog";

import type { BioEditorBlockType } from "@/server/api/routers/bio-page/bio-page.input";
import type { RouterOutputs } from "@/trpc/shared";

type EditorBlock = RouterOutputs["bioPage"]["get"]["blocks"][number];

const TYPE_ICON = {
  link: IconLink,
  heading: IconHeading,
  text: IconAlignLeft,
  email: IconMail,
  whatsapp: IconBrandWhatsapp,
  social: IconWorld,
  divider: IconLine,
} satisfies Record<BioEditorBlockType, typeof IconLink>;

function summarize(block: EditorBlock): string {
  switch (block.type) {
    case "link":
      return block.title || block.url || "Link";
    case "heading":
      return block.title || "Heading";
    case "text":
      return block.content || "Text";
    case "email":
      return block.title || block.url || "Email button";
    case "whatsapp":
      return `${block.title || WHATSAPP_DEFAULT_LABEL} · ${block.whatsapp?.phone ?? ""}`;
    case "social":
      return `${block.socials?.length ?? 0} social ${
        (block.socials?.length ?? 0) === 1 ? "link" : "links"
      }`;
    case "divider":
      return "Divider";
    default:
      return "";
  }
}

export function BlockList({
  pageId,
  blocks,
  onChanged,
  canSchedule,
}: {
  pageId: number;
  blocks: EditorBlock[];
  onChanged: () => void;
  canSchedule: boolean;
}) {
  const [items, setItems] = useState(blocks);
  const [syncedBlocks, setSyncedBlocks] = useState(blocks);
  const [editing, setEditing] = useState<EditorBlock | null>(null);

  // Adopt the server order whenever a new block list arrives.
  if (syncedBlocks !== blocks) {
    setSyncedBlocks(blocks);
    setItems(blocks);
  }

  const utils = api.useUtils();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = api.bioPage.reorderBlocks.useMutation({
    onError: (e) => {
      toast.error(e.message);
      setItems(blocks); // revert local order
      void utils.bioPage.get.invalidate({ id: pageId }); // restore preview from the server
    },
    // No onSuccess refetch: the optimistic cache write below is authoritative,
    // and refetching here could briefly race rapid consecutive reorders.
  });

  function handleDragEnd(event: DragEndEvent) {
    // Serialize reorders: ignore a new drop while a write is in flight, so a
    // slower earlier request can't land last and overwrite the newer order.
    if (reorder.isLoading) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((b) => b.id === active.id);
    const newIndex = items.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    // Optimistically reorder the query cache so the live preview updates in the
    // same frame, instead of waiting for the mutation + refetch round-trip.
    utils.bioPage.get.setData({ id: pageId }, (old) => (old ? { ...old, blocks: next } : old));
    reorder.mutate({ bioPageId: pageId, blockIds: next.map((b) => b.id) });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center text-[13px] text-neutral-400 dark:border-border">
        No blocks yet. Add your first one above.
      </p>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((block) => (
              <SortableRow
                key={block.id}
                block={block}
                onEdit={() => setEditing(block)}
                onChanged={onChanged}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editing && (
        <BlockFormDialog
          pageId={pageId}
          mode="edit"
          type={editing.type}
          block={editing}
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={onChanged}
          canSchedule={canSchedule}
        />
      )}
    </>
  );
}

function SortableRow({
  block,
  onEdit,
  onChanged,
}: {
  block: EditorBlock;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const Icon = TYPE_ICON[block.type];

  const update = api.bioPage.updateBlock.useMutation({
    onSuccess: onChanged,
    onError: (e) => toast.error(e.message),
  });
  // A ref, not isLoading: a fast double-click can land before the mutation's
  // loading state re-renders, and the second delete would fail on a missing row.
  // It stays set after success because the row unmounts once the list refetches.
  const deleting = useRef(false);
  const remove = api.bioPage.deleteBlock.useMutation({
    onSuccess: () => {
      toast.success("Block deleted.");
      onChanged();
    },
    onError: (e) => {
      deleting.current = false;
      toast.error(e.message);
    },
  });

  function confirmDelete() {
    if (deleting.current) return;
    deleting.current = true;
    remove.mutate({ id: block.id });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2.5 transition-colors hover:border-neutral-300 dark:border-border dark:bg-card dark:hover:border-neutral-600 ${
        isDragging ? "z-10 shadow-lg" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <IconGripVertical size={18} stroke={1.5} />
      </button>

      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500 dark:bg-muted dark:text-muted-foreground">
        <Icon size={16} stroke={1.5} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-neutral-800 dark:text-foreground">
          {summarize(block)}
        </p>
        {(block.type === "link" || block.type === "whatsapp") && block.blocked && (
          <Badge variant="secondary" className="mt-0.5 bg-red-100 text-red-700 hover:bg-red-100">
            Blocked
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => update.mutate({ id: block.id, isVisible: !block.isVisible })}
          disabled={update.isLoading || remove.isLoading}
          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-muted"
          title={block.isVisible ? "Hide" : "Show"}
          aria-label={block.isVisible ? "Hide block" : "Show block"}
        >
          {block.isVisible ? (
            <IconEye size={16} stroke={1.5} />
          ) : (
            <IconEyeOff size={16} stroke={1.5} />
          )}
        </button>
        {block.type !== "divider" && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
            title="Edit"
            aria-label="Edit block"
          >
            <IconPencil size={16} stroke={1.5} />
          </button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={remove.isLoading}
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              title="Delete"
              aria-label="Delete block"
            >
              <IconTrash size={16} stroke={1.5} />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this block?</AlertDialogTitle>
              <AlertDialogDescription>
                {block.type === "link" || block.type === "whatsapp"
                  ? "This removes the block, its tracking link, and that link's click history. This cannot be undone."
                  : "This removes the block from your bio page. This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                disabled={remove.isLoading}
                onClick={confirmDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
