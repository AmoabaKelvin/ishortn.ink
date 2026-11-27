"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { inputClass, PayloadField, textareaClass } from "./static-payload-fields";

import type { VCardFormValues } from "../utils";

type VCardFieldsProps = {
  values: VCardFormValues;
  onChange: (patch: Partial<VCardFormValues>) => void;
  errors: Partial<Record<keyof VCardFormValues, string>>;
  /** Keeps ids unique when the create page and an edit drawer are both mounted. */
  idPrefix: string;
};

type TextField = {
  name: keyof VCardFormValues;
  label: string;
  placeholder?: string;
  type?: "email" | "tel" | "url";
};

// Pairs sit side by side where the form column is wide enough: below md the form is full width,
// and from md to xl it shares the page with the preview.
const ROWS: TextField[][] = [
  [
    { name: "firstName", label: "First name" },
    { name: "lastName", label: "Last name", placeholder: "Optional" },
  ],
  [
    { name: "organization", label: "Organisation", placeholder: "Optional" },
    { name: "jobTitle", label: "Job title", placeholder: "Optional" },
  ],
  [
    { name: "phone", label: "Phone", placeholder: "+14155550100", type: "tel" },
    { name: "phone2", label: "Second phone", placeholder: "Optional", type: "tel" },
  ],
  [
    { name: "email", label: "Email", placeholder: "hello@example.com", type: "email" },
    { name: "website", label: "Website", placeholder: "example.com", type: "url" },
  ],
  [{ name: "address", label: "Address", placeholder: "Street, city, postcode, country" }],
];

const INPUT_MODES = { email: "email", tel: "tel", url: "url" } as const;

export function VCardFields({ values, onChange, errors, idPrefix }: VCardFieldsProps) {
  return (
    <>
      {ROWS.map((row) => (
        <div
          key={row[0]!.name}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2"
        >
          {row.map((field) => (
            <div
              key={field.name}
              className={row.length === 1 ? "sm:col-span-2 md:col-span-1 xl:col-span-2" : undefined}
            >
              <PayloadField
                id={`${idPrefix}-${field.name}`}
                label={field.label}
                error={errors[field.name]}
                control={(props) => (
                  <Input
                    {...props}
                    name={`vcard-${field.name}`}
                    type={field.type === "tel" ? "tel" : "text"}
                    inputMode={field.type ? INPUT_MODES[field.type] : undefined}
                    autoComplete="off"
                    spellCheck={field.type ? false : undefined}
                    placeholder={field.placeholder}
                    value={values[field.name]}
                    onChange={(e) => onChange({ [field.name]: e.target.value })}
                    className={inputClass}
                  />
                )}
              />
            </div>
          ))}
        </div>
      ))}
      <PayloadField
        id={`${idPrefix}-note`}
        label="Note"
        error={errors.note}
        control={(props) => (
          <Textarea
            {...props}
            name="vcard-note"
            placeholder="Optional, e.g. office hours"
            value={values.note}
            onChange={(e) => onChange({ note: e.target.value })}
            rows={3}
            className={textareaClass}
          />
        )}
      />
      <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
        Enter a first name or an organisation. Scanning opens a contact page with a Save contact
        button, and you can edit these details after printing.
      </p>
    </>
  );
}
