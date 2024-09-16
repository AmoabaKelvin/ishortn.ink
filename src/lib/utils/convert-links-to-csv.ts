import type { RouterOutputs } from "@/trpc/shared";
type LinkExportData = RouterOutputs["link"]["exportUserLinks"][number];

export const convertDataToCSV = (data: LinkExportData[]) => {
  let csvContent = "data:text/csv;charset=utf-8,";
  const headers = ["createdAt", "url", "alias", "domain", "note"];

  csvContent += headers.join(",") + "\n";

  data.forEach((row: LinkExportData) => {
    const values = headers.map((header) => {
      const value = row[header as keyof LinkExportData];
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === "string") {
        // Escape quotes and wrap in quotes if the value contains a comma
        return value.includes(",") ? `"${value.replace(/"/g, '""')}"` : value;
      }
      return value ?? "";
    });
    csvContent += values.join(",") + "\n";
  });

  return csvContent;
};
