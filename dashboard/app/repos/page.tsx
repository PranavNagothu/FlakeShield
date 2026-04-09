import { GitBranch, AlertTriangle, TrendingUp } from "lucide-react";

const repos = [
  { name: "api-service", owner: "acme-corp", prs: 42, findings: 187, score: 0.68, trend: "down" },
  { name: "auth-service", owner: "acme-corp", prs: 18, findings: 54, score: 0.31, trend: "down" },
  { name: "data-pipeline", owner: "acme-corp", prs: 67, findings: 312, score: 0.82, trend: "up" },
  { name: "frontend-app", owner: "acme-corp", prs: 29, findings: 23, score: 0.15, trend: "down" },
  { name: "scheduler", owner: "acme-corp", prs: 11, findings: 89, score: 0.57, trend: "stable" },
];

function scoreColor(s: number) {
  if (s >= 0.75) return "#ff4d6d";
  if (s >= 0.5) return "#ff8c42";
  if (s >= 0.25) return "#f5c542";
  return "#22d3a0";
}

function scoreLabel(s: number) {
  if (s >= 0.75) return "CRITICAL";
  if (s >= 0.5) return "HIGH";
  if (s >= 0.25) return "MEDIUM";
  return "LOW";
}

export default function ReposPage() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Repositories</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Flakiness posture across all protected repos
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {repos.map((repo) => (
          <div
            key={repo.name}
            className="glass"
            style={{
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: 20,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(79,142,247,0.1)",
                border: "1px solid rgba(79,142,247,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <GitBranch size={18} color="var(--accent-blue)" />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {repo.owner}/{repo.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {repo.prs} PRs analyzed
              </div>
            </div>

            {/* Score bar */}
            <div style={{ width: 160 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Risk Score</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(repo.score) }}>
                  {scoreLabel(repo.score)}
                </span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                <div
                  style={{
                    width: `${repo.score * 100}%`,
                    height: "100%",
                    background: scoreColor(repo.score),
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>

            {/* Findings */}
            <div style={{ textAlign: "center", minWidth: 70 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  color: repo.findings > 100 ? "var(--severity-high)" : "var(--text-secondary)",
                }}
              >
                <AlertTriangle size={13} />
                <span style={{ fontWeight: 700, fontSize: 16 }}>{repo.findings}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>findings</div>
            </div>

            {/* Trend */}
            <div
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                background:
                  repo.trend === "down"
                    ? "rgba(34,211,160,0.1)"
                    : repo.trend === "up"
                    ? "rgba(255,77,109,0.1)"
                    : "rgba(255,255,255,0.06)",
                color:
                  repo.trend === "down"
                    ? "var(--accent-green)"
                    : repo.trend === "up"
                    ? "var(--severity-critical)"
                    : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <TrendingUp size={12} style={{ transform: repo.trend === "down" ? "scaleY(-1)" : "none" }} />
              {repo.trend === "down" ? "Improving" : repo.trend === "up" ? "Worsening" : "Stable"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
