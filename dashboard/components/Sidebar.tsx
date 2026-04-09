"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FlaskConical,
  GitPullRequest,
  BarChart2,
  Settings,
  Shield,
} from "lucide-react";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/repos", label: "Repos", icon: GitPullRequest },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside
      style={{
        width: 220,
        minHeight: "100vh",
        background: "rgba(255,255,255,0.02)",
        borderRight: "1px solid var(--border)",
        padding: "24px 0",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 20px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #4f8ef7, #9b6dff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>
              FlakeShield
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Control Plane</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 10px" }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                marginBottom: 2,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                background: active ? "rgba(79,142,247,0.12)" : "transparent",
                border: active ? "1px solid rgba(79,142,247,0.25)" : "1px solid transparent",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: active ? 500 : 400,
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={16} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "0 20px", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>v0.1.0 · Phase 5</div>
      </div>
    </aside>
  );
}
