"use client";

import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
};

type UtmTemplateSelectorProps = {
  onSelect: (params: UtmParams) => void;
  disabled?: boolean;
};

export function UtmTemplateSelector({
  onSelect,
  disabled = false,
}: UtmTemplateSelectorProps) {
  const { data: templates, isLoading, error } = api.utmTemplate.list.useQuery();

  const handleSelect = (template: NonNullable<typeof templates>[number]) => {
    onSelect({
      utm_source: template.utmSource ?? undefined,
      utm_medium: template.utmMedium ?? undefined,
      utm_campaign: template.utmCampaign ?? undefined,
      utm_term: template.utmTerm ?? undefined,
      utm_content: template.utmContent ?? undefined,
    });
  };

  if (error) {
    return (
      <Button variant="outline" size="sm" disabled className="h-8">
        Error loading templates
      </Button>
    );
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="h-8">
        Loading...
      </Button>
    );
  }

  if (!templates || templates.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={disabled}
        >
          Apply Template
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() => handleSelect(template)}
            className="cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="font-medium">{template.name}</span>
              <span className="text-xs text-gray-500">
                {[
                  template.utmSource && `Source: ${template.utmSource}`,
                  template.utmMedium && `Medium: ${template.utmMedium}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No parameters"}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
