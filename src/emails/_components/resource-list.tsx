import { Text } from "@react-email/components";

import { panelItem, Well } from "./layout";

import type { ResourceCounts } from "@/server/api/routers/account-transfer/account-transfer.service";

const LABELS: Array<[keyof ResourceCounts, string, string]> = [
  ["links", "link", "links"],
  ["customDomains", "custom domain", "custom domains"],
  ["qrCodes", "QR code", "QR codes"],
  ["folders", "folder", "folders"],
  ["tags", "tag", "tags"],
  ["utmTemplates", "UTM template", "UTM templates"],
  ["qrPresets", "QR preset", "QR presets"],
];

export function ResourceList({
  counts,
  emptyLabel,
}: {
  counts: ResourceCounts;
  emptyLabel: string;
}) {
  const rows = LABELS.filter(([key]) => counts[key] > 0);

  return (
    <Well>
      {rows.map(([key, one, many]) => (
        <Text key={key} style={panelItem}>
          {counts[key].toLocaleString()} {counts[key] === 1 ? one : many}
        </Text>
      ))}
      {rows.length === 0 && <Text style={panelItem}>{emptyLabel}</Text>}
    </Well>
  );
}
