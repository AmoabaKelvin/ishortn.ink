"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
          <TabsTrigger value="dns-records">DNS Records</TabsTrigger>
          <TabsTrigger value="vercel-dns">Vercel DNS</TabsTrigger>
        </TabsList>

        <TabsContent value="dns-records" className="space-y-4">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-medium mb-1">DNS configuration required</p>
            <p className="text-xs">
              The DNS records at your provider must match the following records to verify and connect your domain.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Set the following record on your DNS provider:</h4>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900">
                    {verificationChallenges.map((challenge, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {challenge.type}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-1">
                            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                              {challenge.domain}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(challenge.domain)}
                              className="h-6 w-6 shrink-0"
                            >
                              {copiedValue === challenge.domain ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-1">
                            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs max-w-xs truncate">
                              {challenge.value}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(challenge.value)}
                              className="h-6 w-6 shrink-0"
                            >
                              {copiedValue === challenge.value ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
              <p className="font-medium mb-1">DNS propagation may take time</p>
              <p>
                After adding these DNS records, it may take up to 48 hours for the changes to propagate worldwide.
                Use the "Check Now" button to verify your configuration.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vercel-dns" className="space-y-4">
          <div className="rounded-md bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
            <p className="font-medium mb-2">Use Vercel DNS for automatic configuration</p>
            <p className="text-xs mb-3">
              For the easiest setup, you can use Vercel's nameservers. Update your domain's nameservers at your
              registrar to:
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                <code className="text-xs">ns1.vercel-dns.com</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy("ns1.vercel-dns.com")}
                  className="h-7"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                <code className="text-xs">ns2.vercel-dns.com</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy("ns2.vercel-dns.com")}
                  className="h-7"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs mt-3 text-gray-500 dark:text-gray-400">
              Note: This will route all DNS for your domain through Vercel. If you're using other services on this
              domain, use the DNS Records tab instead.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
