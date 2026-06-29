"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadDesk, clearDesk, type Desk } from "../../_lib/desk";
import { shortId, demoMode, setDemoMode } from "../../_lib/ui";

const mono = "'IBM Plex Mono', monospace";

/** Sidebar footer: the authenticated desk identity + sign-out. Replaces the old
 * hardcoded MERIDIAN CAPITAL block with the real keypair's G-address. */
export function DeskFooter() {
  const router = useRouter();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [demo, setDemo] = useState(true);

  useEffect(() => {
    setDesk(loadDesk());
    setDemo(demoMode());
  }, []);

  function signOut() {
    clearDesk();
    router.push("/app/access");
  }

  function toggleDemo() {
    const next = !demo;
    setDemo(next);
    setDemoMode(next);
  }

  return (
    <div className="nyx-shell-footer" style={{ padding: "18px 22px", borderTop: "1px solid #13171C" }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.08em" }}>
        {desk ? desk.label.toUpperCase() : "DESK"}
      </div>
      <div style={{ fontFamily: mono, fontSize: 10, color: "#3D434B", marginTop: 5, wordBreak: "break-all" }}>
        {desk ? shortId(desk.publicKey, 6, 6) : "·"}
      </div>

      {/* Demo-Mode: auto-fill a crossing counterparty after compose. */}
      <button
        type="button"
        onClick={toggleDemo}
        title="When on, a crossing counter-order is auto-posted so a solo order settles. Turn off for a real multi-tab/multi-desk crossing."
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
      >
        <span style={{ width: 24, height: 13, borderRadius: 7, background: demo ? "#0E7E86" : "#15181D", position: "relative", flex: "none", transition: "background 120ms" }}>
          <span style={{ position: "absolute", top: 1.5, left: demo ? 12.5 : 1.5, width: 10, height: 10, borderRadius: "50%", background: demo ? "#3BD7E0" : "#565C64", transition: "left 120ms" }} />
        </span>
        <span style={{ fontFamily: mono, fontSize: 9, color: demo ? "#8A9099" : "#3D434B", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "left" }}>
          Auto-fill counterparty · demo
        </span>
      </button>
      <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
        <button
          type="button"
          onClick={signOut}
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: mono, fontSize: 10, color: "#3D434B", letterSpacing: "0.1em", textTransform: "uppercase" }}
        >
          Sign out
        </button>
        <a href="/" style={{ fontFamily: mono, fontSize: 10, color: "#3D434B", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>
          Exit ↗
        </a>
      </div>
    </div>
  );
}
