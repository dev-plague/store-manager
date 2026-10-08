import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyFlowPoint } from "~/features/metrics/services/metrics.server";
import { formatCompactCurrency, formatCurrency } from "~/lib/money";

// Recharts necesita medir el DOM, así que las gráficas se montan solo en el
// cliente (el SSR renderiza un contenedor del mismo alto para evitar saltos).
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

// Paleta expuesta en app.css (--chart-1..5).
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function MonthlyFlowChart({
  data,
  currency,
  height = 260,
}: {
  data: MonthlyFlowPoint[];
  currency: string;
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            fontSize={12}
            tickFormatter={(value) =>
              formatCompactCurrency(Number(value), currency)
            }
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              formatCurrency(Number(value), currency),
              name === "debtCents" ? "Deudas" : "Abonos",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => (value === "debtCents" ? "Deudas" : "Abonos")}
          />
          <Bar
            dataKey="debtCents"
            fill={CHART_COLORS[0]}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="paymentCents"
            fill={CHART_COLORS[1]}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type RankingItem = {
  label: string;
  value: number;
};

// Barras horizontales para rankings (deudores, tiendas, etc.).
export function BalanceRankingChart({
  data,
  currency,
  color = CHART_COLORS[0],
  height,
}: {
  data: RankingItem[];
  currency: string;
  color?: string;
  height?: number;
}) {
  const mounted = useMounted();
  const computedHeight = height ?? Math.max(120, data.length * 44 + 24);

  if (!mounted) return <div style={{ height: computedHeight }} />;

  return (
    <div style={{ width: "100%", height: computedHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="var(--border)"
          />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            tickFormatter={(value) =>
              formatCompactCurrency(Number(value), currency)
            }
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={tooltipStyle}
            formatter={(value) => [
              formatCurrency(Number(value), currency),
              "Deuda pendiente",
            ]}
          />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
