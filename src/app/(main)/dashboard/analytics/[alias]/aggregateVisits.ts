import type { RouterOutputs } from "@/trpc/shared";

export const aggregateVisits = (linkVisits: RouterOutputs["link"]["linkVisits"]) => {
  const clicksPerDate: Record<string, number> = {};
  const clicksPerCity: Record<string, number> = {};
  const clicksPerCountry: Record<string, number> = {};
  const clicksPerDevice: Record<string, number> = {};
  const clicksPerOS: Record<string, number> = {};
  const clicksPerBrowser: Record<string, number> = {};
  const clicksPerModel: Record<string, number> = {};

  linkVisits.forEach((visit: RouterOutputs["link"]["linkVisits"][number]) => {
    const date = new Date(visit.createdAt!).toLocaleDateString();

    if (!clicksPerDate[date]) {
      clicksPerDate[date] = 0;
    }

    clicksPerDate[date] += 1;

    if (!clicksPerCountry[visit.country!]) {
      clicksPerCountry[visit.country!] = 0;
    }

    clicksPerCountry[visit.country!] += 1;

    if (!clicksPerCity[visit.city!]) {
      clicksPerCity[visit.city!] = 0;
    }

    clicksPerCity[visit.city!] += 1;

    if (!clicksPerDevice[visit.device!]) {
      clicksPerDevice[visit.device!] = 0;
    }

    clicksPerDevice[visit.device!] += 1;

    if (!clicksPerOS[visit.os!]) {
      clicksPerOS[visit.os!] = 0;
    }

    clicksPerOS[visit.os!] += 1;

    if (!clicksPerBrowser[visit.browser!]) {
      clicksPerBrowser[visit.browser!] = 0;
    }

    clicksPerBrowser[visit.browser!] += 1;

    if (!clicksPerModel[visit.model!]) {
      clicksPerModel[visit.model!] = 0;
    }

    clicksPerModel[visit.model!] += 1;

    return {
      clicksPerDate,
      clicksPerCountry,
      clicksPerCity,
      clicksPerDevice,
      clicksPerOS,
      clicksPerBrowser,
      clicksPerModel,
    };
  });

  return {
    clicksPerDate,
    clicksPerCountry,
    clicksPerCity,
    clicksPerDevice,
    clicksPerOS,
    clicksPerBrowser,
    clicksPerModel,
  } as const;
};
