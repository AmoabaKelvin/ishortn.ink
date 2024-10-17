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

  const maxClicks = useMemo(() => Math.max(...Object.values(data)), [data]);
  const colorScale = useMemo(
    () =>
      scaleLinear<string>()
        .domain([0, maxClicks])
        .range(["#e6e7e8", "#2563eb"]),
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
    setTooltipContent(`${countryName}: ${data[countryName] ?? 0} clicks`);
  };

  const handleMouseLeave = () => {
    setTooltipContent(null);
  };

  const getFillColor = (countryName: string) => {
    const clicks = data[countryName] ?? 0;
    return colorScale(clicks);
  };

  return (
    <Card className="h-max">
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
          style={{
            position: "fixed",
            top: tooltipPosition.y,
            left: tooltipPosition.x,
            backgroundColor: "#2563eb",
            color: "#ffffff",
            padding: "5px 10px",
            borderRadius: "5px",
            fontSize: "12px",
          }}
        >
          {tooltipContent}
        </div>
      )}
    </Card>
  );
};

export default WorldMapHeatmap;
