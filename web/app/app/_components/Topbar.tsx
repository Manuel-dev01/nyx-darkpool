import type { ReactNode } from "react";

const serif = "'Spectral', serif";

/** The 60px content header shared by the product screens. */
export function Topbar({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        height: 60,
        flex: "none",
        borderBottom: "1px solid #13171C",
        display: "flex",
        alignItems: "center",
        justifyContent: right ? "space-between" : "flex-start",
        padding: "0 28px",
      }}
    >
      <div style={{ fontFamily: serif, fontSize: 20, color: "#ECEEF0" }}>
        {title}
        {sub ? <span style={{ color: "#3D434B", fontSize: 15 }}> {sub}</span> : null}
      </div>
      {right}
    </div>
  );
}

/** Live status pill used on the Desk header. */
export function LiveDot({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#43C08A", animation: "nyxPulse 2s ease-in-out infinite" }} />
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#8A9099", letterSpacing: "0.1em" }}>{label}</span>
    </div>
  );
}
