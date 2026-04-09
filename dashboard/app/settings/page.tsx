export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Settings</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Configure GitHub integration, thresholds, and team access
        </p>
      </div>

      {[
        {
          title: "GitHub App",
          desc: "Connect your GitHub organization",
          fields: [
            { label: "App ID", value: "", placeholder: "123456" },
            { label: "Webhook Secret", value: "", placeholder: "••••••••••••" },
          ],
        },
        {
          title: "Analysis Thresholds",
          desc: "Customize when FlakeShield blocks a PR",
          fields: [
            { label: "Block PR if score ≥", value: "0.75", placeholder: "0.75" },
            { label: "Warn if score ≥", value: "0.50", placeholder: "0.50" },
          ],
        },
        {
          title: "AI Patch Generation",
          desc: "Claude-powered fix suggestions",
          fields: [
            { label: "Anthropic API Key", value: "", placeholder: "sk-ant-••••" },
            { label: "Model", value: "claude-3-5-sonnet-20241022", placeholder: "" },
          ],
        },
      ].map((section) => (
        <div key={section.title} className="glass" style={{ padding: "24px", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{section.title}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>{section.desc}</div>
          {section.fields.map((f) => (
            <div key={f.label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                {f.label}
              </label>
              <input
                defaultValue={f.value}
                placeholder={f.placeholder}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border-bright)",
                  borderRadius: 10,
                  color: "var(--text-primary)",
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              />
            </div>
          ))}
          <button
            style={{
              marginTop: 8,
              padding: "9px 20px",
              background: "linear-gradient(135deg, #4f8ef7, #9b6dff)",
              border: "none",
              borderRadius: 8,
              color: "white",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Save Changes
          </button>
        </div>
      ))}
    </div>
  );
}
