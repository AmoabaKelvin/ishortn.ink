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
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/shared";
import type { BioBlockType } from "@/server/db/schema";

import { BlockFormDialog } from "./block-form-dialog";

type EditorBlock = RouterOutputs["bioPage"]["get"]["blocks"][number];

const TYPE_ICON: Record<BioBlockType, typeof IconLink> = {
  link: IconLink,
  heading: IconHeading,
  text: IconAlignLeft,
  email: IconMail,
  social: IconWorld,
  divider: IconLine,
};

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
  const [editing, setEditing] = useState<EditorBlock | null>(null);

  useEffect(() => setItems(blocks), [blocks]);

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
                pageId={pageId}
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
  pageId,
  onEdit,
  onChanged,
}: {
  block: EditorBlock;
  pageId: number;
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
  const remove = api.bioPage.deleteBlock.useMutation({
    onSuccess: onChanged,
    onError: (e) => toast.error(e.message),
  });

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

      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500 dark:bg-muted">
        <Icon size={16} stroke={1.5} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-neutral-800 dark:text-foreground">
          {summarize(block)}
        </p>
        {block.type === "link" && block.blocked && (
          <Badge variant="secondary" className="mt-0.5 bg-red-100 text-red-700 hover:bg-red-100">
            Blocked
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={() => update.mutate({ id: block.id, isVisible: !block.isVisible })}
          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
          title={block.isVisible ? "Hide" : "Show"}
        >
          {block.isVisible ? <IconEye size={16} stroke={1.5} /> : <IconEyeOff size={16} stroke={1.5} />}
        </button>
        {block.type !== "divider" && (
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
            title="Edit"
          >
            <IconPencil size={16} stroke={1.5} />
          </button>
        )}
        <button
          onClick={() => remove.mutate({ id: block.id })}
          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <IconTrash size={16} stroke={1.5} />
        </button>
      </div>
    </div>
  );
}
