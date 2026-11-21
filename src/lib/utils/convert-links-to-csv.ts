import type { RouterOutputs } from "@/trpc/shared";
type LinkExportData = RouterOutputs["link"]["exportUserLinks"][number];

const CSV_HEADERS = ["createdAt", "url", "alias", "domain", "note"] as const;

// RFC 4180: quote any field holding a delimiter, quote or line break, and double inner quotes.
const escapeCsvField = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const convertDataToCSV = (data: LinkExportData[]) => {
  const lines = data.map((row) =>
    CSV_HEADERS.map((header) => {
      const value = row[header];
      if (value instanceof Date) return value.toISOString();
      if (value === null) return "";
      return escapeCsvField(value);
    }).join(","),
  );

  return [CSV_HEADERS.join(","), ...lines].join("\r\n") + "\r\n";
};
