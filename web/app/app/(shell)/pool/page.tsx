import type { Metadata } from "next";
import Link from "next/link";
import { Topbar } from "../../_components/Topbar";

export const metadata: Metadata = { title: "Nyx — Pool" };

const mono = "'IBM Plex Mono', monospace";
const sans = "'Archivo', sans-serif";

const LUMEN = new Set([2, 7, 12, 20, 29, 33, 38, 41, 47, 53, 58, 62, 71, 76]);
const MATCH = 26;

function Searching() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <svg width="13" height="13" viewBox="0 0 50 50" style={{ animation: "nyxSpin 1.4s linear infinite" }} aria-hidden="true">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#15181D" strokeWidth="4" />
        <circle cx="25" cy="25" r="20" fill="none" stroke="#3BD7E0" strokeWidth="4" strokeLinecap="round" strokeDasharray="40 86" />
      </svg>
      <span style={{ fontFamily: mono, fontSize: 11, color: "#3BD7E0", letterSpacing: "0.1em" }}>SEARCHING FOR MATCH</span>
    </div>
  );
}

export default function Pool() {
  return (
    <>
      <Topbar title="Pool" sub="/ order #4471" right={<Searching />} />
      <div style={{ flex: 1, display: "flex", minHeight: 0, flexWrap: "wrap" }}>
        {/* lattice */}
        <div style={{ flex: "1.4 1 420px", padding: 32, borderRight: "1px solid #13171C", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: "#8A9099", marginBottom: 8 }}>SHIELDED POOL</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: "#3D434B", marginBottom: 24 }}>317 resting commitments · prices &amp; sizes hidden</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(16,1fr)", gridAutoRows: "1fr", gap: 11, alignContent: "start" }}>
            {Array.from({ length: 80 }).map((_, i) => (
              <span
                key={i}
                style={
                  i === MATCH
                    ? { aspectRatio: "1", border: "1.5px solid #3BD7E0", background: "#0A2E31", animation: "nyxPulse 1.8s ease-in-out infinite" }
                    : { aspectRatio: "1", background: LUMEN.has(i) ? "#3BD7E0" : "#1A1E24" }
                }
              />
            ))}
          </div>
        </div>

        {/* order detail */}
        <div style={{ flex: "1 1 300px", padding: 28, display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: "#8A9099" }}>YOUR ORDER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { k: "Pair", v: <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 14, color: "#ECEEF0" }}>TBILL-26 / USDC</span> },
              { k: "Side", v: <span style={{ fontFamily: mono, fontSize: 13, color: "#43C08A" }}>BID</span> },
              { k: "Price / Size", v: <span style={{ fontFamily: mono, fontSize: 13, color: "#3D434B" }}>•••• · sealed</span> },
              { k: "Resting", v: <span style={{ fontFamily: mono, fontSize: 13, color: "#ECEEF0" }}>00:41</span> },
            ].map((r) => (
              <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64" }}>{r.k}</span>
                {r.v}
              </div>
            ))}
          </div>
          <div style={{ border: "1px solid #15181D", padding: 16 }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Commitment</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: "#3BD7E0", wordBreak: "break-all", lineHeight: 1.5 }}>0x9f3a…c204</div>
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: "#565C64", lineHeight: 1.7, marginTop: "auto" }}>
            {`// counterparties see only your hash.`}<br />{`// a match triggers proof generation.`}
          </div>
          <Link href="/app" style={{ border: "1px solid #23272E", color: "#ECEEF0", fontFamily: sans, fontWeight: 500, fontSize: 13, padding: 13, textAlign: "center", textDecoration: "none" }}>
            Cancel order
          </Link>
        </div>
      </div>
    </>
  );
}
