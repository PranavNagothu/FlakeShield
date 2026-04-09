"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const riskTrend = [
  { week: "W1", score: 0.72, findings: 18 },
  { week: "W2", score: 0.65, findings: 14 },
  { week: "W3", score: 0.58, findings: 12 },
  { week: "W4", score: 0.48, findings: 9 },
  { week: "W5", score: 0.41, findings: 7 },
  { week: "W6", score: 0.33, findings: 5 },
  { week: "W7", score: 0.28, findings: 4 },
  { week: "W8", score: 0.21, findings: 3 },
];

const patternBreakdown = [
  { name: "TIMEOUT001", count: 482, color: "#ff8c42" },
  { name: "STATE001", count: 391, color: "#ff4d6d" },
  { name: "ASYNC001", count: 278, color: "#9b6dff" },
  { name: "TIMEOUT002", count: 234, color: "#f5c542" },
  { name: "ORDER001", count: 187, color: "#4f8ef7" },
  { name: "STATE002", count: 142, color: "#22d3a0" },
  { name: "ASYNC002", count: 98, color: "#a0aec0" },
  { name: "ORDER002", count: 76, color: "#68d391" },
];

const categoryPie = [
  { name: "Timeout", value: 716, color: "#ff8c42" },
  { name: "State", value: 533, color: "#ff4d6d" },
  { name: "Async", value: 376, color: "#9b6dff" },
  { name: "Order", value: 263, color: "#4f8ef7" },
];

const tooltipStyle = {
  background: "#1a1a2e",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#f0f0f5",
  fontSize: 12,
};

export default function AnalyticsPage() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Analytics</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Flakiness trends and pattern breakdown across all repositories
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Risk trend */}
        <div className="glass" style={{ padding: "24px" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Avg Flakiness Score — 8 weeks</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Score dropping 71% → 21% since FlakeShield deployed
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={riskTrend}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: "#555577", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555577", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 1]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#4f8ef7"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#4f8ef7", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        <div className="glass" style={{ padding: "24px" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Findings by Category</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Total 1,888 findings across 12 repos
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <PieChart width={160} height={160}>
              <Pie
                data={categoryPie}
                cx={75}
                cy={75}
                innerRadius={45}
                outerRadius={72}
                dataKey="value"
                strokeWidth={0}
              >
                {categoryPie.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
            <div style={{ flex: 1 }}>
              {categoryPie.map((c) => (
                <div
                  key={c.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pattern breakdown */}
      <div className="glass" style={{ padding: "24px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Top Flakiness Patterns</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Most frequently triggered rules across all analyzed PRs
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={patternBreakdown} layout="vertical">
            <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#555577", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fill: "#888888", fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {patternBreakdown.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
