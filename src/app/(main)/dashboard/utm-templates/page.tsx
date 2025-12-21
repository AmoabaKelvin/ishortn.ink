"use client";

import { Gem, Plus, Target } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
  const { data: userSubscription, isLoading: isLoadingSubscription } = api.subscriptions.get.useQuery();

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  if (!isUltraUser) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Target className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          UTM Templates
        </h2>
        <p className="mt-2 max-w-sm text-center text-sm text-gray-500">
          Create reusable UTM parameter templates to streamline your campaign
          tracking.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-full border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800">
          <Gem className="h-4 w-4 text-slate-500" />
          <span>Available on Ultra plan</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">UTM Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage reusable UTM parameter templates for your links.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <UtmTemplateCard
                key={template.id}
                template={template}
                onEdit={handleEdit}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-12">
            <Target className="h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              No templates yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first UTM template to get started.
            </p>
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        )}
      </div>

      <UtmTemplateModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
        template={editingTemplate}
      />
    </div>
  );
}
