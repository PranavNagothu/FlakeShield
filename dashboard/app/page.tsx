"use client";

import { useState, useEffect } from "react";
import { Shield, Zap, AlertTriangle, TrendingDown, Activity, Wifi, WifiOff } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface OverviewData {
  total_repos: number;
  total_analyses: number;
  total_findings: number;
  ci_minutes_saved: number;
  recent_jobs: {
    repo: string;
    pr: number | null;
    sha: string;
    score: number;
    findings: number;
    status: string;
  }[];
}

// Realistic demo fallback — shown when API is offline (e.g. on Vercel)
const DEMO_DATA: OverviewData = {
  total_repos: 12,
  total_analyses: 847,
  total_findings: 2341,
  ci_minutes_saved: 14046,
  recent_jobs: [
    { repo: "api-service",    pr: 142, sha: "a3f8c21", score: 0.87, findings: 4, status: "completed" },
    { repo: "auth-service",   pr: 89,  sha: "b12e4dc", score: 0.23, findings: 1, status: "completed" },
    { repo: "data-pipeline",  pr: 203, sha: "c9a1b3f", score: 0.94, findings: 7, status: "completed" },
    { repo: "frontend-app",   pr: 67,  sha: "d4f2e18", score: 0.0,  findings: 0, status: "completed" },
    { repo: "scheduler",      pr: 31,  sha: "e7c3a92", score: 0.61, findings: 3, status: "running"   },
  ],
};

function scoreColor(score: number) {
  if (score >= 0.75) return "var(--severity-critical)";
  if (score >= 0.50) return "var(--severity-high)";
  if (score >= 0.25) return "var(--severity-medium)";
  return "var(--accent-green)";
}

function scoreLabel(score: number) {
  if (score >= 0.75) return "CRITICAL";
  if (score >= 0.50) return "HIGH";
  if (score >= 0.25) return "MEDIUM";
  return "LOW";
}

function formatNumber(n: number): string {
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData>(DEMO_DATA);
  const [fromMock, setFromMock] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Try real API first (works locally when backend is running)
    fetch(`${API_BASE}/dashboard/overview`)
      .then((r) => r.json())
      .then((d: OverviewData) => {
        setData(d);
        setFromMock(false);
      })
      .catch(() => {
        // 2. API offline — merge demo baseline with localStorage data from Playground
        try {
          const stored = JSON.parse(localStorage.getItem("fs_stats") || "{}");
          const hasRealData = (stored.total_analyses || 0) > 0;
          setData({
            total_repos: DEMO_DATA.total_repos,
            total_analyses:  hasRealData ? stored.total_analyses   : DEMO_DATA.total_analyses,
            total_findings:  hasRealData ? stored.total_findings   : DEMO_DATA.total_findings,
            ci_minutes_saved: hasRealData ? stored.ci_minutes_saved : DEMO_DATA.ci_minutes_saved,
            recent_jobs:     hasRealData ? stored.recent_jobs      : DEMO_DATA.recent_jobs,
          });
          setFromMock(!hasRealData);
        } catch {
          setData(DEMO_DATA);
          setFromMock(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: "Repos Protected",   value: formatNumber(data.total_repos),       icon: Shield,       color: "#4f8ef7" },
    { label: "PRs Analyzed",      value: formatNumber(data.total_analyses),     icon: Zap,          color: "#9b6dff" },
    { label: "Findings Caught",   value: formatNumber(data.total_findings),     icon: AlertTriangle, color: "#ff8c42" },
    { label: "CI Minutes Saved",  value: formatNumber(data.ci_minutes_saved),   icon: TrendingDown,  color: "#22d3a0" },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 12, color: "var(--accent-green)", fontWeight: 500 }}>LIVE</span>

          {/* Live / Demo badge */}
          <span
            style={{
              marginLeft: 4,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 500,
              background: fromMock ? "rgba(245,197,66,0.1)" : "rgba(34,211,160,0.1)",
              border: `1px solid ${fromMock ? "rgba(245,197,66,0.3)" : "rgba(34,211,160,0.3)"}`,
              color: fromMock ? "#f5c542" : "#22d3a0",
            }}
          >
            {fromMock ? <WifiOff size={11} /> : <Wifi size={11} />}
            {fromMock ? "Demo data" : "Live from API"}
          </span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Overview</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Real-time flakiness prevention across all protected repositories
        </p>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`glass animate-fade-in ${loading ? "shimmer" : ""}`} style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>{value}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{label}</div>
              </div>
              <div
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${color}20`, border: `1px solid ${color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Icon size={18} color={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent jobs table */}
      <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={16} color="var(--accent-blue)" />
            <span style={{ fontWeight: 600 }}>Recent PR Analyses</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {fromMock ? "Demo — run analyses via Playground to populate" : "Last 5 analyses"}
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Repository", "PR", "Commit", "Risk Score", "Findings", "Status"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "12px 24px", textAlign: "left", fontSize: 11,
                    fontWeight: 600, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recent_jobs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                  No analyses yet — go to the <strong>Playground</strong> and click Analyze to get started!
                </td>
              </tr>
            ) : (
              data.recent_jobs.map((job, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < data.recent_jobs.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "14px 24px", fontWeight: 500 }}>{job.repo}</td>
                  <td style={{ padding: "14px 24px", color: "var(--accent-blue)" }}>
                    {job.pr ? `#${job.pr}` : "—"}
                  </td>
                  <td style={{ padding: "14px 24px" }}>
                    <code className="font-mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {job.sha || "—"}
                    </code>
                  </td>
                  <td style={{ padding: "14px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${job.score * 100}%`, height: "100%",
                            background: scoreColor(job.score), borderRadius: 3,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor(job.score) }}>
                        {scoreLabel(job.score)}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 24px" }}>
                    <span
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 28, height: 28, borderRadius: 8,
                        background: job.findings > 0 ? "rgba(255,140,66,0.12)" : "rgba(34,211,160,0.12)",
                        color: job.findings > 0 ? "var(--severity-high)" : "var(--accent-green)",
                        fontWeight: 700, fontSize: 13,
                      }}
                    >
                      {job.findings}
                    </span>
                  </td>
                  <td style={{ padding: "14px 24px" }}>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                        background: job.status === "running" ? "rgba(79,142,247,0.12)" : "rgba(34,211,160,0.12)",
                        color: job.status === "running" ? "var(--accent-blue)" : "var(--accent-green)",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                      }}
                    >
                      {job.status === "running" ? "⟳ Running" : "✓ Done"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
