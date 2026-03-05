"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      <Button variant="outline" size="sm" disabled className="h-8 border-neutral-200 text-[13px]">
        Error loading templates
      </Button>
    );
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="h-8 border-neutral-200 text-[13px]">
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
          className="h-8 border-neutral-200 text-[13px]"
          disabled={disabled}
        >
          Apply Template
          <IconChevronDown size={14} stroke={1.5} className="ml-2" />
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
              <span className="text-[13px] font-medium">{template.name}</span>
              <span className="text-[12px] text-neutral-400">
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
