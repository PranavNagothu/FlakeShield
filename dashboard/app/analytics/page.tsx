"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Wifi, WifiOff } from "lucide-react";

const MOCK_PATTERNS = [
  { rule_id: "TIMEOUT001", count: 482, color: "#ff8c42" },
  { rule_id: "STATE001", count: 391, color: "#ff4d6d" },
  { rule_id: "ASYNC001", count: 278, color: "#9b6dff" },
  { rule_id: "TIMEOUT002", count: 234, color: "#f5c542" },
  { rule_id: "ORDER001", count: 187, color: "#4f8ef7" },
  { rule_id: "STATE002", count: 142, color: "#22d3a0" },
  { rule_id: "ASYNC002", count: 98, color: "#a0aec0" },
  { rule_id: "ORDER002", count: 76, color: "#68d391" },
];

const MOCK_TREND = [
  { week: "W1", score: 0.72 }, { week: "W2", score: 0.65 },
  { week: "W3", score: 0.58 }, { week: "W4", score: 0.48 },
  { week: "W5", score: 0.41 }, { week: "W6", score: 0.33 },
  { week: "W7", score: 0.28 }, { week: "W8", score: 0.21 },
];

const CATEGORY_COLORS: Record<string, string> = {
  TIMEOUT001: "#ff8c42", TIMEOUT002: "#f5c542",
  STATE001: "#ff4d6d", STATE002: "#22d3a0",
  ASYNC001: "#9b6dff", ASYNC002: "#a0aec0",
  ORDER001: "#4f8ef7", ORDER002: "#68d391",
};

const tooltipStyle = {
  background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "#f0f0f5", fontSize: 12,
};

interface Pattern { rule_id: string; count: number; color?: string }

export default function AnalyticsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>(MOCK_PATTERNS);
  const [fromMock, setFromMock] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/dashboard/top-patterns")
      .then((r) => r.json())
      .then((data: Pattern[]) => {
        if (data.length > 0) {
          setPatterns(data.map((p) => ({ ...p, color: CATEGORY_COLORS[p.rule_id] || "#4f8ef7" })));
          setFromMock(false);
        }
      })
      .catch(() => {}); // stay on mock
  }, []);

  // Derive pie data from patterns
  const categoryTotals: Record<string, number> = {};
  patterns.forEach((p) => {
    const cat = p.rule_id.replace(/\d+/g, "").toLowerCase();
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    categoryTotals[label] = (categoryTotals[label] || 0) + p.count;
  });
  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value,
    color: { Timeout: "#ff8c42", State: "#ff4d6d", Async: "#9b6dff", Order: "#4f8ef7" }[name] || "#888",
  }));

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Analytics</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Flakiness trends and pattern breakdown across all repositories
          </p>
        </div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999,
            background: fromMock ? "rgba(245,197,66,0.1)" : "rgba(34,211,160,0.1)",
            border: `1px solid ${fromMock ? "rgba(245,197,66,0.3)" : "rgba(34,211,160,0.3)"}`,
            fontSize: 12, color: fromMock ? "#f5c542" : "#22d3a0", fontWeight: 500,
          }}
        >
          {fromMock ? <WifiOff size={12} /> : <Wifi size={12} />}
          {fromMock ? "Demo data — start API to see live data" : "Live from API"}
        </div>
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
            <LineChart data={MOCK_TREND}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: "#555577", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555577", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 1]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="score" stroke="#4f8ef7" strokeWidth={2.5}
                dot={{ r: 4, fill: "#4f8ef7", strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        <div className="glass" style={{ padding: "24px" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Findings by Category</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {fromMock ? "Demo distribution" : "Live from your repos"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <PieChart width={160} height={160}>
              <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={72} dataKey="value" strokeWidth={0}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <div style={{ flex: 1 }}>
              {pieData.map((c) => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
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
            {fromMock ? "Demo data — run analyses via Playground to populate this" : "Most triggered rules across all analyzed PRs"}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(200, patterns.length * 30)}>
          <BarChart data={patterns} layout="vertical">
            <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#555577", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="rule_id" type="category"
              tick={{ fill: "#888888", fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false} tickLine={false} width={90} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {patterns.map((entry, i) => <Cell key={i} fill={entry.color || "#4f8ef7"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
