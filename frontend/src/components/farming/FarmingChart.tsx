"use client";

import React from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
  [key: string]: number | string | undefined;
}

export interface FarmingChartProps {
  data: ChartDataPoint[];
  type?: "line" | "area" | "bar";
  dataKey: string;
  title?: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
  formatYAxis?: (value: number) => string;
  formatXAxis?: (value: number) => string;
  isLoading?: boolean;
}

export function FarmingChart({
  data,
  type = "line",
  dataKey,
  title,
  color = "#a855f7", // purple-500
  height = 300,
  showGrid = true,
  showLegend = false,
  yAxisLabel,
  xAxisLabel,
  formatYAxis = (value) => value.toFixed(2),
  formatXAxis = (value) => new Date(value * 1000).toLocaleDateString(),
  isLoading = false,
}: FarmingChartProps) {
  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-purple-500/30 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-gray-400 mb-1">
            {formatXAxis(payload[0].payload.timestamp)}
          </p>
          <p className="text-sm font-bold text-white">
            {yAxisLabel}: {formatYAxis(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div
        className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-purple-500/20"
        style={{ height }}
      >
        {title && (
          <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
            {title}
          </h3>
        )}
        <div className="animate-pulse flex items-center justify-center h-full">
          <div className="text-gray-400">Loading chart data...</div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-purple-500/20 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-gray-400">No data available</p>
        </div>
      </div>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 10, left: 0, bottom: 0 },
    };

    switch (type) {
      case "area":
        return (
          <AreaChart {...commonProps}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            )}
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
              tick={{ fill: "#9ca3af" }}
            />
            <YAxis
              tickFormatter={formatYAxis}
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
              tick={{ fill: "#9ca3af" }}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "#9ca3af", fontSize: "12px" },
                    }
                  : undefined
              }
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={`${color}30`}
              strokeWidth={2}
            />
          </AreaChart>
        );

      case "bar":
        return (
          <BarChart {...commonProps}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            )}
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
              tick={{ fill: "#9ca3af" }}
            />
            <YAxis
              tickFormatter={formatYAxis}
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
              tick={{ fill: "#9ca3af" }}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        );

      case "line":
      default:
        return (
          <LineChart {...commonProps}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            )}
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
              tick={{ fill: "#9ca3af" }}
            />
            <YAxis
              tickFormatter={formatYAxis}
              stroke="#9ca3af"
              style={{ fontSize: "12px" }}
              tick={{ fill: "#9ca3af" }}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "#9ca3af", fontSize: "12px" },
                    }
                  : undefined
              }
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-purple-500/20">
      {title && (
        <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
      {xAxisLabel && (
        <p className="text-xs text-gray-400 text-center mt-2">{xAxisLabel}</p>
      )}
    </div>
  );
}
