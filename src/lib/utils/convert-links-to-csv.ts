import type { RouterOutputs } from "@/trpc/shared";
type LinkExportData = RouterOutputs["link"]["exportUserLinks"][number];

export const convertDataToCSV = (data: LinkExportData[]) => {
  let csvContent = "data:text/csv;charset=utf-8,";
  const headers = ["createdAt", "url", "alias", "domain", "note"] as const;

  csvContent += `${headers.join(",")}\n`;

  data.forEach((row: LinkExportData) => {
    const values = headers.map((header) => {
      const value = row[header];
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value === null) {
        return "";
      }
      // Escape quotes and wrap in quotes if the value contains a comma
      return value.includes(",") ? `"${value.replace(/"/g, '""')}"` : value;
    });
    csvContent += `${values.join(",")}\n`;
  });

  return csvContent;
};
