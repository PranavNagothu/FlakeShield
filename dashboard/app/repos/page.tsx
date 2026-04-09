import { GitBranch, AlertTriangle, TrendingUp, Wifi, WifiOff } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface RepoSummary {
  id: string;
  owner: string;
  name: string;
  prs: number;
  score: number;
  findings: number;
}

const MOCK_REPOS: RepoSummary[] = [
  { id: "1", owner: "acme-corp", name: "api-service", prs: 42, findings: 187, score: 0.68 },
  { id: "2", owner: "acme-corp", name: "auth-service", prs: 18, findings: 54, score: 0.31 },
  { id: "3", owner: "acme-corp", name: "data-pipeline", prs: 67, findings: 312, score: 0.82 },
  { id: "4", owner: "acme-corp", name: "frontend-app", prs: 29, findings: 23, score: 0.15 },
  { id: "5", owner: "acme-corp", name: "scheduler", prs: 11, findings: 89, score: 0.57 },
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

export default async function ReposPage() {
  const { data: repos, fromMock } = await apiFetch<RepoSummary[]>(
    "/dashboard/repos",
    MOCK_REPOS
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Repositories</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Flakiness posture across all protected repos
          </p>
        </div>
        {/* Live / Mock indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            background: fromMock ? "rgba(245,197,66,0.1)" : "rgba(34,211,160,0.1)",
            border: `1px solid ${fromMock ? "rgba(245,197,66,0.3)" : "rgba(34,211,160,0.3)"}`,
            fontSize: 12,
            color: fromMock ? "#f5c542" : "#22d3a0",
            fontWeight: 500,
          }}
        >
          {fromMock ? <WifiOff size={12} /> : <Wifi size={12} />}
          {fromMock ? "Demo data" : "Live from API"}
        </div>
      </div>

      {repos.length === 0 ? (
        <div
          className="glass"
          style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}
        >
          <GitBranch size={40} style={{ opacity: 0.3, marginBottom: 16 }} />
          <div>No repos registered yet.</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>
            Install the GitHub App or use <code>POST /repos</code> to add one.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="glass"
              style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, cursor: "pointer" }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "rgba(79,142,247,0.1)",
                  border: "1px solid rgba(79,142,247,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <GitBranch size={18} color="var(--accent-blue)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{repo.owner}/{repo.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{repo.prs} PRs analyzed</div>
              </div>
              <div style={{ width: 160 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Risk Score</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(repo.score) }}>
                    {scoreLabel(repo.score)}
                  </span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                  <div style={{ width: `${repo.score * 100}%`, height: "100%", background: scoreColor(repo.score), borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ textAlign: "center", minWidth: 70 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: repo.findings > 100 ? "var(--severity-high)" : "var(--text-secondary)" }}>
                  <AlertTriangle size={13} />
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{repo.findings}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>findings</div>
              </div>
              <div
                style={{
                  padding: "4px 12px", borderRadius: 999,
                  background: repo.score < 0.5 ? "rgba(34,211,160,0.1)" : repo.score >= 0.75 ? "rgba(255,77,109,0.1)" : "rgba(255,255,255,0.06)",
                  color: repo.score < 0.5 ? "var(--accent-green)" : repo.score >= 0.75 ? "var(--severity-critical)" : "var(--text-muted)",
                  fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <TrendingUp size={12} style={{ transform: repo.score < 0.5 ? "scaleY(-1)" : "none" }} />
                {repo.score < 0.5 ? "Low risk" : repo.score >= 0.75 ? "High risk" : "Moderate"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
