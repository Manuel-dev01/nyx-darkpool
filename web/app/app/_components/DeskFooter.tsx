"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadDesk, clearDesk, type Desk } from "../../_lib/desk";
import { shortId } from "../../_lib/ui";

const mono = "'IBM Plex Mono', monospace";

/** Sidebar footer: the authenticated desk identity + sign-out. Replaces the old
 * hardcoded MERIDIAN CAPITAL block with the real keypair's G-address. */
export function DeskFooter() {
  const router = useRouter();
  const [desk, setDesk] = useState<Desk | null>(null);

  useEffect(() => { setDesk(loadDesk()); }, []);

  function signOut() {
    clearDesk();
    router.push("/app/access");
  }

  return (
    <div style={{ padding: "18px 22px", borderTop: "1px solid #13171C" }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.08em" }}>
        {desk ? desk.label.toUpperCase() : "DESK"}
      </div>
      <div style={{ fontFamily: mono, fontSize: 10, color: "#3D434B", marginTop: 5, wordBreak: "break-all" }}>
        {desk ? shortId(desk.publicKey, 6, 6) : "—"}
      </div>
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
