"use client";

import { Shield, Zap, AlertTriangle, TrendingDown, Activity } from "lucide-react";


const stats = [
  { label: "Repos Protected", value: "12", icon: Shield, color: "#4f8ef7" },
  { label: "PRs Analyzed", value: "847", icon: Zap, color: "#9b6dff" },
  { label: "Findings Caught", value: "2,341", icon: AlertTriangle, color: "#ff8c42" },
  { label: "CI Minutes Saved", value: "14,200", icon: TrendingDown, color: "#22d3a0" },
];

const recentJobs = [
  { repo: "api-service", pr: 142, sha: "a3f8c21", score: 0.87, findings: 4, status: "completed" },
  { repo: "auth-service", pr: 89, sha: "b12e4dc", score: 0.23, findings: 1, status: "completed" },
  { repo: "data-pipeline", pr: 203, sha: "c9a1b3f", score: 0.94, findings: 7, status: "completed" },
  { repo: "frontend-app", pr: 67, sha: "d4f2e18", score: 0.0, findings: 0, status: "completed" },
  { repo: "scheduler", pr: 31, sha: "e7c3a92", score: 0.61, findings: 3, status: "running" },
];

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

export default function OverviewPage() {
  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 12, color: "var(--accent-green)", fontWeight: 500 }}>LIVE</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
          Overview
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Real-time flakiness prevention across all protected repositories
        </p>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass animate-fade-in" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>{value}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{label}</div>
              </div>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${color}20`,
                  border: `1px solid ${color}40`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={18} color={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent jobs */}
      <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={16} color="var(--accent-blue)" />
            <span style={{ fontWeight: 600 }}>Recent PR Analyses</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Last 24 hours</span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Repository", "PR", "Commit", "Risk Score", "Findings", "Status"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "12px 24px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentJobs.map((job, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: i < recentJobs.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "14px 24px", fontWeight: 500 }}>{job.repo}</td>
                <td style={{ padding: "14px 24px", color: "var(--accent-blue)" }}>#{job.pr}</td>
                <td style={{ padding: "14px 24px" }}>
                  <code className="font-mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {job.sha}
                  </code>
                </td>
                <td style={{ padding: "14px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 60,
                        height: 6,
                        borderRadius: 3,
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${job.score * 100}%`,
                          height: "100%",
                          background: scoreColor(job.score),
                          borderRadius: 3,
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
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: job.findings > 0 ? "rgba(255,140,66,0.12)" : "rgba(34,211,160,0.12)",
                      color: job.findings > 0 ? "var(--severity-high)" : "var(--accent-green)",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {job.findings}
                  </span>
                </td>
                <td style={{ padding: "14px 24px" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background:
                        job.status === "running"
                          ? "rgba(79,142,247,0.12)"
                          : "rgba(34,211,160,0.12)",
                      color:
                        job.status === "running" ? "var(--accent-blue)" : "var(--accent-green)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {job.status === "running" ? "⟳ Running" : "✓ Done"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
