"use client";

import { useState } from "react";
import { Play, Sparkles, AlertTriangle, CheckCircle, Clock, Copy } from "lucide-react";

const SAMPLE_CODE = `import time
import requests

# Module-level mutable state — persists across tests
RESULTS = []

async def test_api_response():
    # Blocking call inside async function
    time.sleep(5)
    
    # Network call without timeout
    resp = requests.get("http://api.example.com/data")
    assert resp.status_code == 200
    
    RESULTS.append(resp.json())
`;

const MOCK_FINDINGS = [
  {
    rule_id: "ASYNC001",
    category: "async",
    severity: "HIGH",
    line_start: 8,
    line_end: 8,
    snippet: "time.sleep(5)",
    explanation: "Blocking call inside an async function blocks the event loop and causes non-deterministic timing failures in CI.",
    suggested_fix: "await asyncio.sleep(5)",
    confidence: 0.92,
  },
  {
    rule_id: "TIMEOUT001",
    category: "timeout",
    severity: "HIGH",
    line_start: 8,
    line_end: 8,
    snippet: "time.sleep(5)",
    explanation: "Hardcoded timeout value '5' makes this test sensitive to machine speed. Slow CI runners will fail intermittently.",
    suggested_fix: "poll_until_ready(timeout=10, interval=0.1)",
    confidence: 0.97,
  },
  {
    rule_id: "TIMEOUT002",
    category: "timeout",
    severity: "MEDIUM",
    line_start: 11,
    line_end: 11,
    snippet: 'requests.get("http://api.example.com/data")',
    explanation: "Network call without a 'timeout' parameter will hang indefinitely in CI if the remote service is slow.",
    suggested_fix: 'requests.get("http://api.example.com/data", timeout=30)',
    confidence: 0.88,
  },
  {
    rule_id: "STATE001",
    category: "state",
    severity: "CRITICAL",
    line_start: 4,
    line_end: 4,
    snippet: "RESULTS = []",
    explanation: "Module-level mutable variable 'RESULTS' persists across all tests. Tests that run first may pollute state for subsequent tests.",
    suggested_fix: "@pytest.fixture\ndef results():\n    return []",
    confidence: 0.94,
  },
];

const severityConfig: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "#ff4d6d", bg: "rgba(255,77,109,0.1)", border: "rgba(255,77,109,0.3)" },
  HIGH: { color: "#ff8c42", bg: "rgba(255,140,66,0.1)", border: "rgba(255,140,66,0.3)" },
  MEDIUM: { color: "#f5c542", bg: "rgba(245,197,66,0.1)", border: "rgba(245,197,66,0.3)" },
  LOW: { color: "#4f8ef7", bg: "rgba(79,142,247,0.1)", border: "rgba(79,142,247,0.3)" },
};

const categoryIcon: Record<string, string> = {
  async: "⚡",
  timeout: "⏱",
  state: "📦",
  order: "🔗",
};

export default function PlaygroundPage() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState("python");
  const [findings, setFindings] = useState<typeof MOCK_FINDINGS>([]);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseMs, setParseMs] = useState<number | null>(null);
  const [copiedFix, setCopiedFix] = useState<string | null>(null);

  async function analyze() {
    setLoading(true);
    setFindings([]);
    setScore(null);

    try {
      // Try the real analyzer, fallback to mock
      const res = await fetch("http://localhost:8001/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, content: code }),
      });

      if (res.ok) {
        const data = await res.json();
        setFindings(data.findings || []);
        setScore(data.flakiness_score);
        setParseMs(data.parse_time_ms);
      } else {
        throw new Error("API error");
      }
    } catch {
      // Mock mode — demo without backend
      await new Promise((r) => setTimeout(r, 900));
      setFindings(MOCK_FINDINGS);
      setScore(0.91);
      setParseMs(42);
    } finally {
      setLoading(false);
    }
  }

  function copyFix(fix: string) {
    navigator.clipboard.writeText(fix);
    setCopiedFix(fix);
    setTimeout(() => setCopiedFix(null), 2000);
  }

  const scoreLabel =
    score === null
      ? null
      : score >= 0.75
      ? "CRITICAL"
      : score >= 0.5
      ? "HIGH"
      : score >= 0.25
      ? "MEDIUM"
      : "LOW";

  const scoreColor =
    score === null
      ? null
      : score >= 0.75
      ? "#ff4d6d"
      : score >= 0.5
      ? "#ff8c42"
      : score >= 0.25
      ? "#f5c542"
      : "#22d3a0";

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
          Playground
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Paste any test file and detect flakiness patterns instantly — no GitHub setup required
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 20 }}>
        {/* Left: Code editor */}
        <div>
          {/* Toolbar */}
          <div
            className="glass"
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 2,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: "none",
            }}
          >
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border-bright)",
                borderRadius: 8,
                color: "var(--text-primary)",
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <option value="python">Python</option>
              <option value="typescript">TypeScript</option>
            </select>

            <div style={{ flex: 1 }} />

            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {code.split("\n").length} lines
            </span>

            <button
              onClick={analyze}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 20px",
                background: loading
                  ? "rgba(79,142,247,0.2)"
                  : "linear-gradient(135deg, #4f8ef7, #9b6dff)",
                border: "none",
                borderRadius: 8,
                color: "white",
                fontWeight: 600,
                fontSize: 13,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.2s",
              }}
            >
              {loading ? (
                <>
                  <Clock size={14} style={{ animation: "spin 1s linear infinite" }} />
                  Analyzing…
                </>
              ) : (
                <>
                  <Play size={14} />
                  Analyze
                </>
              )}
            </button>
          </div>

          {/* Code textarea */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderRadius: "0 0 16px 16px",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex" }}>
              {/* Line numbers */}
              <div
                className="font-mono"
                style={{
                  padding: "16px 12px",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  lineHeight: "1.7",
                  textAlign: "right",
                  userSelect: "none",
                  borderRight: "1px solid var(--border)",
                  minWidth: 42,
                }}
              >
                {code.split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="font-mono"
                style={{
                  flex: 1,
                  padding: "16px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  lineHeight: "1.7",
                  resize: "none",
                  minHeight: 420,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          </div>

          {/* Score bar */}
          {score !== null && (
            <div
              className="glass animate-fade-in"
              style={{ marginTop: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Flakiness Risk Score
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor! }}>
                    {scoreLabel} · {(score * 100).toFixed(0)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${score * 100}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}aa)`,
                      borderRadius: 4,
                      transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </div>
              </div>
              {parseMs !== null && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Parse time</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-green)" }}>
                    {parseMs}ms
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Findings panel */}
        <div>
          <div
            className="glass"
            style={{ padding: 0, overflow: "hidden", height: "100%", minHeight: 480 }}
          >
            {/* Panel header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={15} color="var(--accent-orange)" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Findings</span>
              </div>
              {findings.length > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    background: "rgba(255,140,66,0.15)",
                    color: "var(--severity-high)",
                    padding: "2px 10px",
                    borderRadius: 999,
                  }}
                >
                  {findings.length}
                </span>
              )}
            </div>

            {/* Empty / loading / findings */}
            <div style={{ padding: 16, overflowY: "auto", maxHeight: 600 }}>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="shimmer"
                      style={{ height: 80, borderRadius: 12 }}
                    />
                  ))}
                </div>
              ) : findings.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: "var(--text-muted)",
                  }}
                >
                  <CheckCircle
                    size={40}
                    color="var(--text-muted)"
                    style={{ marginBottom: 12, opacity: 0.5 }}
                  />
                  <div style={{ fontSize: 14 }}>
                    {score === null
                      ? "Click Analyze to scan for flaky patterns"
                      : "No flaky patterns detected 🎉"}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {findings.map((f, i) => {
                    const cfg = severityConfig[f.severity] || severityConfig.LOW;
                    return (
                      <div
                        key={i}
                        className="animate-fade-in"
                        style={{
                          background: cfg.bg,
                          border: `1px solid ${cfg.border}`,
                          borderRadius: 12,
                          padding: 14,
                          animationDelay: `${i * 0.08}s`,
                          animationFillMode: "both",
                        }}
                      >
                        {/* Rule header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{categoryIcon[f.category] || "🔍"}</span>
                          <code
                            className="font-mono"
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: cfg.color,
                              background: `${cfg.bg}`,
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {f.rule_id}
                          </code>
                          <span
                            className="severity-badge"
                            style={{
                              background: cfg.bg,
                              color: cfg.color,
                              border: `1px solid ${cfg.border}`,
                              fontSize: 10,
                              padding: "1px 8px",
                            }}
                          >
                            {f.severity}
                          </span>
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: 11,
                              color: "var(--text-muted)",
                            }}
                          >
                            L{f.line_start}
                          </span>
                        </div>

                        {/* Snippet */}
                        <code
                          className="font-mono"
                          style={{
                            display: "block",
                            fontSize: 12,
                            background: "rgba(0,0,0,0.3)",
                            padding: "6px 10px",
                            borderRadius: 6,
                            color: "var(--text-primary)",
                            marginBottom: 8,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {f.snippet}
                        </code>

                        {/* Explanation */}
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>
                          {f.explanation}
                        </p>

                        {/* Suggested fix */}
                        {f.suggested_fix && (
                          <div
                            style={{
                              background: "rgba(34,211,160,0.08)",
                              border: "1px solid rgba(34,211,160,0.2)",
                              borderRadius: 8,
                              padding: "8px 10px",
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 10, color: "var(--accent-green)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                ✦ Suggested Fix
                              </div>
                              <code className="font-mono" style={{ fontSize: 11, color: "var(--accent-green)" }}>
                                {f.suggested_fix}
                              </code>
                            </div>
                            <button
                              onClick={() => copyFix(f.suggested_fix)}
                              style={{
                                padding: "4px 8px",
                                background: "transparent",
                                border: "1px solid rgba(34,211,160,0.3)",
                                borderRadius: 6,
                                color: "var(--accent-green)",
                                cursor: "pointer",
                                fontSize: 11,
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Copy size={10} />
                              {copiedFix === f.suggested_fix ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        )}

                        {/* Confidence */}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            Confidence: {(f.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
