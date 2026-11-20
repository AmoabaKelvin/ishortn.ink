import type { RouterOutputs } from "@/trpc/shared";
type LinkExportData = RouterOutputs["link"]["exportUserLinks"][number];

export const convertDataToJSON = (data: LinkExportData[]) => {
  const formattedData = data.map((item: LinkExportData) => ({
    ...item,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
  }));

  return JSON.stringify(formattedData, null, 2);
};
