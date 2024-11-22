"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type MonthlyUsageProps = {
  monthlyLinkCount: number;
  isProUser: boolean;
};

const MonthlyUsage = ({ monthlyLinkCount, isProUser }: MonthlyUsageProps) => {
  if (isProUser) {
    return null; // Don't show for pro users
  }

  const limit = 30;
  const percentage = Math.min((monthlyLinkCount / limit) * 100, 100);
  const isNearLimit = monthlyLinkCount >= 25;
  const isAtLimit = monthlyLinkCount >= limit;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Monthly Link Usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Progress value={percentage} className="h-2" />
          <div className="flex flex-col text-sm">
            <span
              className={
                isAtLimit ? "text-red-600 font-medium" : "text-gray-500"
              }
            >
              {monthlyLinkCount} / {limit} links used
            </span>
            {isNearLimit && !isAtLimit && (
              <span className="text-yellow-600">
                Almost at limit! Upgrade to Pro for unlimited links.
              </span>
            )}
            {isAtLimit && (
              <span className="text-red-600">
                Limit reached! Upgrade to Pro for unlimited links.
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyUsage;
