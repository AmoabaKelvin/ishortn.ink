"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { WIFI_SECURITY_TYPES } from "@/lib/qr-generator/payload";

import type { StaticFormValues } from "../utils";
import type { StaticQrPayloadType, WifiSecurity } from "@/lib/qr-generator/payload";

export type StaticFieldErrors = Partial<Record<keyof StaticFormValues, string>>;

const WIFI_SECURITY_LABELS = {
  WPA: "WPA/WPA2",
  WEP: "WEP",
  nopass: "None",
} satisfies Record<WifiSecurity, string>;

const labelClass = "text-[13px] font-medium text-neutral-700 dark:text-neutral-300";
const inputClass =
  "h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card";
const textareaClass =
  "resize-none border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card";

type StaticPayloadFieldsProps = {
  type: StaticQrPayloadType;
  values: StaticFormValues;
  onChange: (patch: Partial<StaticFormValues>) => void;
  errors: StaticFieldErrors;
  /** Keeps ids unique when the create page and an edit drawer are both mounted. */
  idPrefix: string;
};

export function StaticPayloadFields({
  type,
  values,
  onChange,
  errors,
  idPrefix,
}: StaticPayloadFieldsProps) {
  const field = (
    name: keyof StaticFormValues,
    label: string,
    control: (props: {
      id: string;
      "aria-invalid": boolean;
      "aria-describedby"?: string;
    }) => React.ReactNode,
    hint?: string,
  ) => {
    const id = `${idPrefix}-${name}`;
    const error = errors[name];
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className={labelClass}>
          {label}
        </Label>
        {control({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
        {error ? (
          <p id={`${id}-error`} className="text-[12px] text-red-500">
            {error}
          </p>
        ) : (
          hint && (
            <p
              id={`${id}-hint`}
              className="text-[12px] text-neutral-400 dark:text-muted-foreground"
            >
              {hint}
            </p>
          )
        )}
      </div>
    );
  };

  switch (type) {
    case "text":
      return field("text", "Text", (props) => (
        <Textarea
          {...props}
          name="text"
          placeholder="The text people see when they scan"
          value={values.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={3}
          className={textareaClass}
        />
      ));

    case "wifi":
      return (
        <>
          {field("ssid", "Network name", (props) => (
            <Input
              {...props}
              name="ssid"
              autoComplete="off"
              placeholder="Cafe Guest"
              value={values.ssid}
              onChange={(e) => onChange({ ssid: e.target.value })}
              className={inputClass}
            />
          ))}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-security`} className={labelClass}>
              Security
            </Label>
            <Select
              value={values.security}
              onValueChange={(value) => {
                const security = WIFI_SECURITY_TYPES.find((option) => option === value);
                if (security) onChange({ security });
              }}
            >
              <SelectTrigger
                id={`${idPrefix}-security`}
                className="h-9 w-full border-neutral-200 bg-white text-[13px] text-neutral-700 dark:border-border dark:bg-card dark:text-neutral-300"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIFI_SECURITY_TYPES.map((security) => (
                  <SelectItem key={security} value={security}>
                    {WIFI_SECURITY_LABELS[security]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {values.security !== "nopass" &&
            field("password", "Password", (props) => (
              <Input
                {...props}
                name="wifi-password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Network password"
                value={values.password}
                onChange={(e) => onChange({ password: e.target.value })}
                className={inputClass}
              />
            ))}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor={`${idPrefix}-hidden`} className={labelClass}>
                Hidden network
              </Label>
              <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                Turn on if the network doesn't broadcast its name.
              </p>
            </div>
            <Switch
              id={`${idPrefix}-hidden`}
              checked={values.hidden}
              onCheckedChange={(hidden) => onChange({ hidden })}
              className="mt-0.5 shrink-0"
            />
          </div>
        </>
      );

    case "email":
      return (
        <>
          {field("to", "To", (props) => (
            <Input
              {...props}
              name="email-to"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="hello@example.com"
              value={values.to}
              onChange={(e) => onChange({ to: e.target.value })}
              className={inputClass}
            />
          ))}
          {field("subject", "Subject", (props) => (
            <Input
              {...props}
              name="email-subject"
              placeholder="Optional"
              value={values.subject}
              onChange={(e) => onChange({ subject: e.target.value })}
              className={inputClass}
            />
          ))}
          {field("body", "Message", (props) => (
            <Textarea
              {...props}
              name="email-body"
              placeholder="Optional"
              value={values.body}
              onChange={(e) => onChange({ body: e.target.value })}
              rows={3}
              className={textareaClass}
            />
          ))}
        </>
      );

    case "sms":
    case "phone":
      return (
        <>
          {field(
            "phone",
            "Phone number",
            (props) => (
              <Input
                {...props}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="+14155550100"
                value={values.phone}
                onChange={(e) => onChange({ phone: e.target.value })}
                className={inputClass}
              />
            ),
            "Include the country code, e.g. +44 for the UK.",
          )}
          {type === "sms" &&
            field("message", "Message", (props) => (
              <Textarea
                {...props}
                name="sms-message"
                placeholder="Optional text to pre-fill"
                value={values.message}
                onChange={(e) => onChange({ message: e.target.value })}
                rows={3}
                className={textareaClass}
              />
            ))}
        </>
      );
  }
}
