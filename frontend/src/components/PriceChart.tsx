import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PriceChartProps {
  data: Array<{ price: number; recordedAt: string }>;
}

export default function PriceChart({ data }: PriceChartProps) {
  if (data.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-8">No price history yet.</p>;
  }

  const chartData = [...data]
    .reverse()
    .map((d) => ({
      time: new Date(d.recordedAt).toLocaleTimeString(),
      price: d.price,
    }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#374151" }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#374151" }}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#priceGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
