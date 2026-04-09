"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyToClipboard } from "@/lib/utils";

type Challenge = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
};

type DNSRecordsSectionProps = {
  verificationChallenges: Challenge[];
};

export function DNSRecordsSection({ verificationChallenges }: DNSRecordsSectionProps) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const handleCopy = async (value: string) => {
    await copyToClipboard(value);
    setCopiedValue(value);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedValue(null), 2000);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="dns-records" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dns-records" className="text-[12px]">
            DNS Records
          </TabsTrigger>
          <TabsTrigger value="vercel-dns" className="text-[12px]">
            Vercel DNS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dns-records" className="space-y-3">
          <div className="rounded-lg border border-amber-100 bg-amber-50 dark:bg-amber-500/10 p-3">
            <p className="text-[12px] font-medium text-amber-700">
              DNS configuration required
            </p>
            <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
              The DNS records at your provider must match the following records
              to verify your domain.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
              Set the following record on your DNS provider:
            </p>
            <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-border">
              <table className="min-w-full divide-y divide-neutral-100">
                <thead className="bg-neutral-50 dark:bg-accent/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                      Type
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white dark:bg-card">
                  {verificationChallenges.map((challenge, index) => (
                    <tr key={index} className="hover:bg-neutral-50 dark:hover:bg-accent/50">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex items-center rounded-md border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                          {challenge.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <code className="rounded-md border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-400">
                            {challenge.domain}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(challenge.domain)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
                          >
                            {copiedValue === challenge.domain ? (
                              <IconCheck size={12} stroke={1.5} className="text-emerald-500" />
                            ) : (
                              <IconCopy size={12} stroke={1.5} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <code className="max-w-[180px] truncate rounded-md border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-400">
                            {challenge.value}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(challenge.value)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
                          >
                            {copiedValue === challenge.value ? (
                              <IconCheck size={12} stroke={1.5} className="text-emerald-500" />
                            ) : (
                              <IconCopy size={12} stroke={1.5} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 p-3">
              <p className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                DNS propagation may take time
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
                After adding these DNS records, it may take up to 48 hours for
                changes to propagate. Use &quot;Check Now&quot; to verify your
                configuration.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vercel-dns" className="space-y-3">
          <div className="rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 p-4">
            <p className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
              Use Vercel DNS for automatic configuration
            </p>
            <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
              Update your domain&apos;s nameservers at your registrar to:
            </p>
            <div className="mt-3 space-y-2">
              {["ns1.vercel-dns.com", "ns2.vercel-dns.com"].map((ns) => (
                <div
                  key={ns}
                  className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-border bg-white dark:bg-card px-3 py-2"
                >
                  <code className="text-[11px] text-neutral-600 dark:text-neutral-400">{ns}</code>
                  <button
                    type="button"
                    onClick={() => handleCopy(ns)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
                  >
                    {copiedValue === ns ? (
                      <IconCheck size={12} stroke={1.5} className="text-emerald-500" />
                    ) : (
                      <IconCopy size={12} stroke={1.5} />
                    )}
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-neutral-400 dark:text-neutral-500">
              Note: This will route all DNS for your domain through Vercel. If
              you use other services on this domain, use the DNS Records tab
              instead.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
