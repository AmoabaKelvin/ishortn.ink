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
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-700">
            <p className="font-medium mb-1">DNS configuration required</p>
            <p className="text-xs">
              The DNS records at your provider must match the following records to verify and connect your domain.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Set the following record on your DNS provider:</h4>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                        Type
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                        Name
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {verificationChallenges.map((challenge, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-lg bg-gray-50 border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                            {challenge.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <code className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                              {challenge.domain}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(challenge.domain)}
                              className="h-7 w-7 shrink-0 text-gray-400 hover:text-gray-600"
                            >
                              {copiedValue === challenge.domain ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <code className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 max-w-xs truncate">
                              {challenge.value}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(challenge.value)}
                              className="h-7 w-7 shrink-0 text-gray-400 hover:text-gray-600"
                            >
                              {copiedValue === challenge.value ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
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

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
              <p className="font-medium mb-1 text-gray-700">DNS propagation may take time</p>
              <p>
                After adding these DNS records, it may take up to 48 hours for the changes to propagate worldwide.
                Use the "Check Now" button to verify your configuration.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vercel-dns" className="space-y-4">
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
            <p className="font-medium mb-2 text-gray-700">Use Vercel DNS for automatic configuration</p>
            <p className="text-xs mb-3">
              For the easiest setup, you can use Vercel's nameservers. Update your domain's nameservers at your
              registrar to:
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-200">
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
              <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-200">
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
            <p className="text-xs mt-3 text-gray-500">
              Note: This will route all DNS for your domain through Vercel. If you're using other services on this
              domain, use the DNS Records tab instead.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
