import { ColoredDistributionCard } from "./colored-distribution-card";

type ShortLinksCardProps = {
  clicksByLink: Record<string, number>;
  totalClicks: number;
};

export function ShortLinksCard({
  clicksByLink,
  totalClicks,
}: ShortLinksCardProps) {
  const items = Object.entries(clicksByLink).map(([name, clicks]) => ({
    name,
    clicks,
  }));

  return (
    <ColoredDistributionCard
      title="Short Links"
      description="Click distribution by short links"
      items={items}
      totalClicks={totalClicks}
    />
  );
}

