"use client";

import { scaleLinear } from "d3-scale";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

import { Card } from "@/components/ui/card";
import { useMemo, useState } from "react";

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

type CountryData = {
  [countryName: string]: number;
};

type WorldMapHeatmapProps = {
  data: CountryData;
};

const WorldMapHeatmap = ({ data }: WorldMapHeatmapProps) => {
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<
    Record<string, number>
  >({ x: 0, y: 0 });

  const maxClicks = useMemo(() => {
    const values = Object.values(data);
    if (values.length === 0) return 1;
    return Math.max(...values) || 1;
  }, [data]);
  const colorScale = useMemo(
    () =>
      scaleLinear<string>()
        .domain([0, maxClicks])
        .range(["#f5f5f5", "#2563eb"]),
    [maxClicks]
  );

  const handleMouseMove = (event: React.MouseEvent) => {
    setTooltipPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleMouseEnter = (event: React.MouseEvent, countryName: string) => {
    handleMouseMove(event);
    const displayName =
      countryName === "United States of America"
        ? "United States"
        : countryName;
    setTooltipContent(
      `${displayName}: ${getClicksForCountry(displayName)} clicks`
    );
  };

  const handleMouseLeave = () => {
    setTooltipContent(null);
  };

  const getClicksForCountry = (countryName: string) => {
    if (countryName === "United States of America") {
      return data["United States"] ?? 0;
    }
    return data[countryName] ?? 0;
  };

  const getFillColor = (countryName: string) => {
    const clicks = getClicksForCountry(countryName);
    return colorScale(clicks);
  };

  return (
    <Card className="h-max rounded-xl border-neutral-200 dark:border-border shadow-none">
      <ComposableMap projection="geoMercator">
        <ZoomableGroup zoom={0.8} minZoom={0.7} center={[0, 40]}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const countryName = geo.properties.name;

                return (
                  <Geography
                    key={countryName}
                    geography={geo}
                    fill={getFillColor(countryName)}
                    stroke="#FFFFFF"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: "#60a5fa" },
                      pressed: { outline: "none" },
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, countryName)}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      {tooltipContent && tooltipPosition && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white shadow-md"
          style={{
            top: (tooltipPosition.y ?? 0) - 10,
            left: (tooltipPosition.x ?? 0) + 12,
          }}
        >
          {tooltipContent}
        </div>
      )}
    </Card>
  );
};

export default WorldMapHeatmap;
