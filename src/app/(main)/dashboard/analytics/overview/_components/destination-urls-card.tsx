import { ColoredDistributionCard } from "./colored-distribution-card";

type DestinationUrlsCardProps = {
  clicksByDestination: Record<string, number>;
  totalClicks: number;
};

export function DestinationUrlsCard({
  clicksByDestination,
  totalClicks,
}: DestinationUrlsCardProps) {
  const items = Object.entries(clicksByDestination).map(([name, clicks]) => ({
    name: name.length > 60 ? `${name.substring(0, 60)}...` : name,
    clicks,
  }));

  return (
    <ColoredDistributionCard
      title="Destination URLs"
      description="Click distribution by destination URLs"
      items={items}
      totalClicks={totalClicks}
    />
  );
}

