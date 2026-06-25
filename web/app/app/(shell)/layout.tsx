import Link from "next/link";
import { Eclipse } from "../../_components/Eclipse";
import { SideNav } from "../_components/SideNav";
import { DeskFooter } from "../_components/DeskFooter";
import { AuthGate } from "../_components/AuthGate";

const serif = "'Spectral', serif";

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

        <DeskFooter />
      </div>

      {/* content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>
        <AuthGate>{children}</AuthGate>
      </div>
    </div>
  );
}
