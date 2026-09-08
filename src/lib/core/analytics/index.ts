import type { RouterOutputs } from "@/trpc/shared";

function safeIncrement<T extends string>(record: Record<T, number>, key: T): void {
  record[key] = (record[key] || 0) + 1;
}

type AggregateVisitsParams = {
  visits: RouterOutputs["link"]["linkVisits"]["totalVisits"];
  uniqueVisits: RouterOutputs["link"]["linkVisits"]["uniqueVisits"];
};

export const aggregateVisits = (
  visits: AggregateVisitsParams["visits"],
  uniqueVisits: AggregateVisitsParams["uniqueVisits"],
) => {
  const clicksPerDate: Record<string, number> = {};
  const uniqueClicksPerDate: Record<string, number> = {};
  const verifiedClicksPerDate: Record<string, number> = {};
  const clicksPerCountry: Record<string, number> = {};
  const clicksPerCity: Record<string, number> = {};
  const clicksPerContinent: Record<string, number> = {};
  const clicksPerDevice: Record<string, number> = {};
  const clicksPerOS: Record<string, number> = {};
  const clicksPerBrowser: Record<string, number> = {};
  const clicksPerModel: Record<string, number> = {};
  let totalClicks = 0;
  let verifiedClicks = 0;

  visits.forEach((visit) => {
    const date = new Date(visit.createdAt!).toISOString().split("T")[0];
    safeIncrement(clicksPerDate, date!);
    totalClicks += 1;

    if (visit.verifiedAt) {
      verifiedClicks += 1;
      safeIncrement(verifiedClicksPerDate, date!);
    }

    if (visit.country) safeIncrement(clicksPerCountry, visit.country);
    if (visit.city) safeIncrement(clicksPerCity, visit.city);
    if (visit.continent) safeIncrement(clicksPerContinent, visit.continent);
    if (visit.device) safeIncrement(clicksPerDevice, visit.device);
    if (visit.os) safeIncrement(clicksPerOS, visit.os);
    if (visit.browser) safeIncrement(clicksPerBrowser, visit.browser);
    if (visit.model) safeIncrement(clicksPerModel, visit.model);
  });

  if (!uniqueVisits)
    return {
      totalClicks,
      verifiedClicks,
      clicksPerDate,
      verifiedClicksPerDate,
      clicksPerCountry,
      clicksPerCity,
      clicksPerContinent,
      clicksPerDevice,
      clicksPerOS,
      clicksPerBrowser,
      clicksPerModel,
    };

  uniqueVisits.forEach((uniqueVisit) => {
    const date = new Date(uniqueVisit.createdAt!).toISOString().split("T")[0];
    safeIncrement(uniqueClicksPerDate, date!);
  });

  return {
    totalClicks,
    verifiedClicks,
    clicksPerDate,
    uniqueClicksPerDate,
    verifiedClicksPerDate,
    clicksPerCountry,
    clicksPerCity,
    clicksPerContinent,
    clicksPerDevice,
    clicksPerOS,
    clicksPerBrowser,
    clicksPerModel,
  };
};

export type ArchivedClicks = {
  clicks: number;
  uniqueClicks: number;
  clicksPerDate: Record<string, number>;
  uniqueClicksPerDate: Record<string, number>;
};

// Raw visits older than the retention window are rolled up into daily
// summaries by the cleanup job. Only counts survive, so per-date series and
// totals can include them but country/device/referrer breakdowns cannot.
export const mergeArchivedClicks = (
  aggregated: {
    clicksPerDate: Record<string, number>;
    uniqueClicksPerDate?: Record<string, number>;
  },
  archived: ArchivedClicks,
) => {
  const clicksPerDate = { ...aggregated.clicksPerDate };
  const uniqueClicksPerDate = { ...aggregated.uniqueClicksPerDate };
  for (const [date, n] of Object.entries(archived.clicksPerDate)) {
    clicksPerDate[date] = (clicksPerDate[date] ?? 0) + n;
  }
  for (const [date, n] of Object.entries(archived.uniqueClicksPerDate)) {
    uniqueClicksPerDate[date] = (uniqueClicksPerDate[date] ?? 0) + n;
  }
  const sortByDate = (m: Record<string, number>) =>
    Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  return {
    clicksPerDate: sortByDate(clicksPerDate),
    uniqueClicksPerDate: sortByDate(uniqueClicksPerDate),
  };
};

export const summarizeArchived = (
  rows: { date: string; clicks: number; uniqueClicks: number }[],
): ArchivedClicks =>
  rows.reduce<ArchivedClicks>(
    (acc, s) => {
      acc.clicks += s.clicks;
      acc.uniqueClicks += s.uniqueClicks;
      acc.clicksPerDate[s.date] = (acc.clicksPerDate[s.date] ?? 0) + s.clicks;
      acc.uniqueClicksPerDate[s.date] = (acc.uniqueClicksPerDate[s.date] ?? 0) + s.uniqueClicks;
      return acc;
    },
    { clicks: 0, uniqueClicks: 0, clicksPerDate: {}, uniqueClicksPerDate: {} },
  );
