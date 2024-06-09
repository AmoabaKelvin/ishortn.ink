"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type BarChartProps = {
  clicksPerDate: Record<string, number>;
  className?: string;
};

export function BarChart({ clicksPerDate, className }: BarChartProps) {
  const data = {
    labels: Object.keys(clicksPerDate),
    datasets: [
      {
        data: Object.values(clicksPerDate),
        barPercentage: 0.5,
        categoryPercentage: 0.5,
        backgroundColor: "#3b82f6",
        borderColor: "#3b82f6",
        borderWidth: 1,
      },
    ],
  };

  return <Bar data={data} options={options} className={className} />;
}

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: ({ raw }: { raw: unknown }) => `${raw as string} clicks`,
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      grid: {
        display: false,
      },
    },
  },
};
