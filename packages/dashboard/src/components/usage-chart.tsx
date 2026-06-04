import { useState, useEffect } from "react";
import { api } from "../lib/api-client";

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
}

export default function UsageChart() {
  const [dailyData, setDailyData] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getDailyUsage(30)
      .then(setDailyData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading usage data...</p>;
  if (error) return <p style={{ color: "var(--color-error)" }}>Error: {error}</p>;

  const maxTokens = Math.max(...dailyData.map((d) => d.tokens), 1);
  const totalTokens = dailyData.reduce((s, d) => s + d.tokens, 0);
  const totalCost = dailyData.reduce((s, d) => s + d.cost, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 14, color: "var(--color-ink-muted)", marginBottom: 4 }}>
            Total Tokens (30d)
          </p>
          <p style={{ fontSize: 32, fontWeight: 300 }}>
            {totalTokens.toLocaleString()}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 14, color: "var(--color-ink-muted)", marginBottom: 4 }}>
            Total Cost (30d)
          </p>
          <p style={{ fontSize: 32, fontWeight: 300 }}>
            {(totalCost / 100).toLocaleString("vi-VN", {
              style: "currency",
              currency: "VND",
            })}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, alignItems: "end", height: 120, marginBottom: 8 }}>
        {dailyData.slice(-14).map((d) => {
          const height = maxTokens > 0 ? (d.tokens / maxTokens) * 100 : 0;
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.tokens.toLocaleString()} tokens`}
              style={{
                flex: 1,
                background: "var(--color-primary)",
                height: `${Math.max(height, 2)}%`,
                minHeight: 2,
                opacity: 0.8,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-ink-muted)" }}>
        <span>{dailyData[0]?.date?.slice(5) ?? ""}</span>
        <span>{dailyData[dailyData.length - 1]?.date?.slice(5) ?? ""}</span>
      </div>
    </div>
  );
}
