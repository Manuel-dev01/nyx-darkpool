import Link from "next/link";
import { Eclipse } from "../../_components/Eclipse";
import { SideNav } from "../_components/SideNav";

const serif = "'Spectral', serif";
const mono = "'IBM Plex Mono', monospace";

/**
 * The Nyx product shell — a full-screen dark app frame (sidebar + content),
 * productized from the App design canvas (which presented the screens as
 * floating cards on a light board). The sidebar lives here so every screen
 * shares it; the content area scrolls independently. The /app/access sign-in
 * screen sits OUTSIDE this group, so it renders without the shell.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        background: "#07080A",
        color: "#ECEEF0",
        fontFamily: "'Archivo', sans-serif",
        WebkitFontSmoothing: "antialiased",
        overflow: "hidden",
      }}
    >
      {/* sidebar */}
      <div
        style={{
          width: 208,
          flex: "none",
          borderRight: "1px solid #13171C",
          display: "flex",
          flexDirection: "column",
          background: "#08090B",
        }}
      >
        <Link
          href="/app"
          style={{
            padding: 22,
            borderBottom: "1px solid #13171C",
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "#ECEEF0",
          }}
        >
          <Eclipse size={18} />
          <span style={{ fontFamily: serif, fontSize: 17 }}>Nyx</span>
        </Link>

        <SideNav />

        <div style={{ padding: "18px 22px", borderTop: "1px solid #13171C" }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.08em" }}>MERIDIAN CAPITAL</div>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#3D434B", marginTop: 5 }}>Desk 04 · key 7af0</div>
          <Link href="/" style={{ display: "inline-block", marginTop: 14, fontFamily: mono, fontSize: 10, color: "#3D434B", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>
            ← Exit to site
          </Link>
        </div>
      </div>

      {/* content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}
