import {
  IconBriefcase,
  IconDownload,
  IconMail,
  IconMapPin,
  IconPhone,
  IconWorld,
} from "@tabler/icons-react";

import { REPORT_ABUSE_URL } from "@/components/link-status/utils";
import { Button } from "@/components/ui/button";
import { telHref, vcardDisplayName } from "@/lib/qr-generator/vcard";
import { cn } from "@/lib/utils";

import type { VCardPayload } from "@/lib/qr-generator/vcard";
import type { ReactNode } from "react";

function initials(card: VCardPayload) {
  const parts = card.firstName ? [card.firstName, card.lastName] : [card.organization];
  return parts
    .filter(Boolean)
    .map((part) => Array.from(part.trim())[0] ?? "")
    .join("")
    .toUpperCase();
}

type Action = { key: string; icon: ReactNode; label: string; value: string; href: string };

function actionsFor(card: VCardPayload): Action[] {
  const icon = (Icon: typeof IconPhone) => <Icon size={16} stroke={1.5} />;
  const actions: Action[] = [];
  for (const [index, phone] of [card.phone, card.phone2].entries()) {
    if (phone) {
      actions.push({
        key: `phone-${index}`,
        icon: icon(IconPhone),
        label: "Call",
        value: phone,
        href: telHref(phone),
      });
    }
  }
  if (card.email) {
    actions.push({
      key: "email",
      icon: icon(IconMail),
      label: "Email",
      value: card.email,
      href: `mailto:${card.email}`,
    });
  }
  if (card.website) {
    actions.push({
      key: "website",
      icon: icon(IconWorld),
      label: "Website",
      value: card.website.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
      href: card.website,
    });
  }
  if (card.address) {
    actions.push({
      key: "address",
      icon: icon(IconMapPin),
      label: "Address",
      value: card.address,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}`,
    });
  }
  return actions;
}

/** The hosted contact page for a vCard code. `publicId` is the card's /c/<publicId>. */
export function ContactCardView({
  publicId,
  card,
  className,
}: {
  publicId: string;
  card: VCardPayload;
  className?: string;
}) {
  const name = vcardDisplayName(card);
  // A company card shows its name as the heading, so the organisation isn't repeated.
  const role = [card.jobTitle, name === card.organization ? "" : card.organization]
    .filter(Boolean)
    .join(" · ");
  const actions = actionsFor(card);

  return (
    <main
      className={cn("min-h-[100dvh] bg-neutral-50 px-4 py-8 dark:bg-accent/50 sm:py-16", className)}
    >
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-border dark:bg-card">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 text-[14px] font-semibold text-neutral-700 dark:bg-muted dark:text-neutral-300"
            >
              {initials(card) || <IconBriefcase size={16} stroke={1.5} />}
            </div>
            <h1 className="mt-4 max-w-full text-xl font-semibold tracking-tight text-balance break-words text-neutral-900 dark:text-foreground">
              {name}
            </h1>
            {role && (
              <p className="mt-1 max-w-full text-[13px] text-pretty break-words text-neutral-500 dark:text-neutral-400">
                {role}
              </p>
            )}
          </div>

          <Button
            asChild
            className="mt-5 h-10 w-full rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
          >
            <a href={`/c/${publicId}/vcf`} download>
              <IconDownload size={16} stroke={2} />
              Save contact
            </a>
          </Button>

          {/* Actions */}
          {actions.length > 0 && (
            <ul className="mt-5 divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-border/50 dark:border-border/50">
              {actions.map((action) => (
                <li key={action.key}>
                  <a
                    href={action.href}
                    {...(action.key === "website" && { rel: "noopener noreferrer nofollow" })}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-neutral-50 dark:hover:bg-accent/50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-muted dark:text-neutral-400">
                      {action.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] text-neutral-400 dark:text-muted-foreground">
                        {action.label}
                      </span>
                      <span className="block break-words text-[13px] font-medium text-neutral-900 dark:text-foreground">
                        {action.value}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {card.note && (
            <div className="mt-4 rounded-lg bg-neutral-50 p-4 dark:bg-accent/50">
              <p className="text-[13px] whitespace-pre-line break-words text-neutral-700 dark:text-neutral-300">
                {card.note}
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[12px]">
          <a
            href={REPORT_ABUSE_URL}
            className="rounded-md text-neutral-400 underline-offset-2 hover:text-neutral-600 hover:underline dark:text-muted-foreground dark:hover:text-neutral-300"
          >
            Report abuse
          </a>
        </p>
      </div>
    </main>
  );
}
