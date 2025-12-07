"use client";

import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { useState } from "react";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

import { DomainCardDropdown } from "./domain-card-dropdown";
import DomainStatusChecker from "./domain-status-checker";

import type { RouterOutputs } from "@/trpc/shared";

type DomainCardProps = {
  domain: RouterOutputs["customDomain"]["list"][0];
};

type VerificationDetails = {
  type: string;
  domain: string;
  value: string;
  reason: string;
}[];

export default function DomainCard({ domain }: DomainCardProps) {
  const [status, setStatus] = useState(domain.status);
  // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
  let verificationChallenges;

  try {
    verificationChallenges = JSON.parse(
      (domain.verificationDetails as string) ?? "[]"
    ) as VerificationDetails;
  } catch (_error) {
    verificationChallenges = domain.verificationDetails as VerificationDetails;
  }

  const handleStatusChange = async (
    newStatus: "pending" | "active" | "invalid"
  ) => {
    setStatus(newStatus);

    if (newStatus === "active" || status === "invalid") {
      await revalidateRoute("/dashboard/domains");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl">
          <div className="flex flex-col gap-2">
            <span>{domain.domain}</span>
            {domain.status === "active" ? (
              <div className="flex items-center gap-2 text-sm font-normal text-green-600 dark:text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                <span>Valid Configuration</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-normal text-red-600 dark:text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>Invalid Configuration</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(domain.status === "pending" || domain.status === "invalid") && (
              <DomainStatusChecker
                domain={domain.domain!}
                initialStatus={domain.status}
                onStatusChange={handleStatusChange}
              />
            )}
            <DomainCardDropdown domainId={domain.id} />
          </div>
        </CardTitle>
        <CardDescription>
          {domain.status === "active" ? (
            <span>Your domain is successfully connected. </span>
          ) : (
            <span>Please validate your domain before it can be used. </span>
          )}
        </CardDescription>

        {domain.status === "invalid" || domain.status === "pending" ? (
          <CardContent className="px-0 pt-6">
            <Alert className="mb-7">
              <AlertDescription>
                Warning: If you are using this domain for another site, setting
                this TXT record will transfer domain ownership away from that
                site and potentially disrupt its functionality. Please exercise
                caution when configuring this record. Ensure that the domain
                specified in the TXT verification value is the one you intend to
                use with ishortn.ink and not your production site.
              </AlertDescription>
            </Alert>
            <div className="space-y-4">
              {verificationChallenges.map((challenge) => (
                <div key={challenge.domain}>
                  <h3 className="mb-2 font-semibold">
                    {challenge.type} Record
                  </h3>
                  <div className="flex items-center gap-2 rounded bg-secondary p-2">
                    <code className="flex-grow text-sm">
                      Name: <strong>{challenge.domain}</strong>
                      <br />
                      <br />
                      Value: {challenge.value}
                    </code>
                    <Button variant="ghost" size="sm">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div>
                <h3 className="mb-2 font-semibold">Instructions</h3>
                <ol className="list-inside list-decimal space-y-2">
                  <li>
                    There might be multiple verification challenges. You only
                    need to complete one.
                  </li>
                  <li>Copy the record shown above.</li>
                  <li>
                    Go to your DNS provider and add a new record based on the
                    type shown above. E.g. if it's a TXT record, add a new TXT
                    record.
                  </li>
                  <li>Enter the domain and value shown above.</li>
                  <li>
                    Save the changes and wait for DNS propagation (may take up
                    to 48 hours).
                  </li>
                  <li>
                    Once done, click the "Verify" button in the domain settings
                    to confirm.
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        ) : null}
      </CardHeader>
    </Card>
  );
}
