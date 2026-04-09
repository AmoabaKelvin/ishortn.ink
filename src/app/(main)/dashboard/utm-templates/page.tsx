"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  IconDiamond,
  IconLoader2,
  IconPlus,
  IconTarget,
} from "@tabler/icons-react";
import { useState } from "react";

import { api } from "@/trpc/react";

import { UtmTemplateCard } from "./_components/utm-template-card";
import { UtmTemplateModal } from "./_components/utm-template-modal";

import type { UtmTemplate } from "@/server/db/schema";

export default function UtmTemplatesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<UtmTemplate | null>(
    null
  );

  const { data: templates, isLoading } = api.utmTemplate.list.useQuery();
  const { data: userSubscription, isLoading: isLoadingSubscription } =
    api.subscriptions.get.useQuery();

  const isUltraUser = userSubscription?.subscriptions?.plan === "ultra";

  const handleEdit = (template: UtmTemplate) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };

  const handleCloseModal = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setEditingTemplate(null);
    }
  };

  if (isLoadingSubscription) {
    return (
      <div className="flex justify-center py-16">
        <IconLoader2
          size={20}
          stroke={1.5}
          className="animate-spin text-neutral-400 dark:text-neutral-500"
        />
      </div>
    );
  }

  if (!isUltraUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden py-20"
      >
        {/* Dotted grid background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgb(212 212 212 / 0.5) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            maskImage:
              "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 100%)",
          }}
        />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="relative"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
            <IconTarget
              size={24}
              stroke={1.5}
              className="text-neutral-400 dark:text-neutral-500"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="mt-6 text-center"
        >
          <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
            UTM Templates
          </p>
          <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-400 dark:text-neutral-500">
            Create reusable UTM parameter templates to streamline your campaign
            tracking.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-3 py-1.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
            <IconDiamond
              size={14}
              stroke={1.5}
              className="text-neutral-400 dark:text-neutral-500"
            />
            Available on Ultra plan
          </span>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            UTM Templates
          </h1>
          {templates && templates.length > 0 && (
            <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
              {templates.length}{" "}
              {templates.length === 1 ? "template" : "templates"} total
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
        >
          <IconPlus size={16} stroke={2} />
          New Template
        </button>
      </div>

      {isLoading ? (
        <div className="divide-y divide-neutral-300/60 dark:divide-border">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-1 py-4">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-40 animate-pulse rounded bg-neutral-100 dark:bg-muted" />
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-3 w-48 animate-pulse rounded bg-neutral-100 dark:bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="divide-y divide-neutral-300/60 dark:divide-border">
          <AnimatePresence>
            {templates.map((template, index) => (
              <UtmTemplateCard
                key={template.id}
                template={template}
                index={index}
                onEdit={handleEdit}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden py-16"
        >
          {/* Dotted grid background */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgb(212 212 212 / 0.5) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              maskImage:
                "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 100%)",
            }}
          />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="relative"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
              <IconTarget
                size={24}
                stroke={1.5}
                className="text-neutral-400 dark:text-neutral-500"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="mt-6 text-center"
          >
            <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
              No templates yet
            </p>
            <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-400 dark:text-neutral-500">
              Create your first UTM template to get started.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
          >
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
            >
              <IconPlus size={16} stroke={2} />
              Create Template
            </button>
          </motion.div>
        </motion.div>
      )}

      <UtmTemplateModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
        template={editingTemplate}
      />
    </div>
  );
}
