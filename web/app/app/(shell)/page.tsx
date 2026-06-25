import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Topbar, LiveDot } from "../_components/Topbar";

export const metadata: Metadata = { title: "Nyx — Desk" };

const mono = "'IBM Plex Mono', monospace";

const STATS = [
  { k: "Open orders", v: "7", accent: false },
  { k: "Resting in pool", v: "4", accent: true },
  { k: "Settled · 24h", v: "$48.0M", accent: false },
  { k: "Net exposure", v: "+$12.4M", accent: false },
];

const ORDERS = [
  { pair: "TBILL-26/USDC", side: "BID", commit: "0x9f3a…c204", status: "● PROVEN", sideC: "#43C08A", statusC: "#3BD7E0" },
  { pair: "GOLD-RWA/USDC", side: "ASK", commit: "0x2b81…7af0", status: "● SEALED", sideC: "#E05A6E", statusC: "#8A9099" },
  { pair: "CRE-DEBT-A/USDC", side: "BID", commit: "0xa10c…9b22", status: "● PROVEN", sideC: "#43C08A", statusC: "#3BD7E0" },
  { pair: "SOLAR-ABS/USDC", side: "BID", commit: "0x81b0…2e6c", status: "● SEALED", sideC: "#43C08A", statusC: "#8A9099" },
  { pair: "TBILL-26/USDC", side: "ASK", commit: "0xc3f9…40ab", status: "● MATCHED", sideC: "#E05A6E", statusC: "#43C08A" },
];

const ACTIVITY: { t: string; node: React.ReactNode }[] = [
  { t: "14:22", node: <>Order <span style={{ color: "#3BD7E0" }}>#4471</span> proof verified on-chain.</> },
  { t: "14:19", node: <>Match found for <span style={{ color: "#43C08A" }}>#4470</span> in pool.</> },
  { t: "14:17", node: <>Order #4469 sealed &amp; broadcast.</> },
  { t: "14:11", node: <>Settled <span style={{ color: "#43C08A" }}>$11.2M</span> · GOLD-RWA.</> },
  { t: "14:03", node: <>Order #4468 sealed &amp; broadcast.</> },
];

const orderGrid: CSSProperties = { display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr", gap: 12, padding: "14px 20px", fontFamily: mono, fontSize: 12, alignItems: "center" };

export default function Desk() {
  return (
    <>
      <Topbar title="Desk" right={<LiveDot label="LIVE · 14:22 UTC" />} />
      <div style={{ flex: 1, padding: 28 }}>
        {/* stat row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#13171C", border: "1px solid #13171C", marginBottom: 24 }}>
          {STATS.map((s) => (
            <div key={s.k} style={{ background: "#07080A", padding: "20px 22px" }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: "#3D434B", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.k}</div>
              <div style={{ fontFamily: mono, fontSize: 26, color: s.accent ? "#3BD7E0" : "#ECEEF0", marginTop: 8 }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* open orders */}
          <div style={{ flex: "1.5 1 420px", border: "1px solid #13171C", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #13171C" }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: "#8A9099" }}>OPEN ORDERS</span>
              <Link href="/app/compose" style={{ fontFamily: mono, fontSize: 11, color: "#07080A", background: "#3BD7E0", padding: "6px 12px", textDecoration: "none" }}>+ New</Link>
            </div>
            <div style={{ ...orderGrid, padding: "11px 20px", fontSize: 10, letterSpacing: "0.1em", color: "#3D434B", borderBottom: "1px solid #13171C" }}>
              <span>PAIR</span><span>SIDE</span><span>COMMITMENT</span><span style={{ textAlign: "right" }}>STATUS</span>
            </div>
            {ORDERS.map((o, i) => (
              <div key={i} style={{ ...orderGrid, borderBottom: i < ORDERS.length - 1 ? "1px solid #0E1115" : "none", background: i % 2 === 1 ? "#0A0C0F" : "transparent" }}>
                <span style={{ color: "#ECEEF0" }}>{o.pair}</span>
                <span style={{ color: o.sideC }}>{o.side}</span>
                <span style={{ color: "#565C64" }}>{o.commit}</span>
                <span style={{ textAlign: "right", color: o.statusC }}>{o.status}</span>
              </div>
            ))}
          </div>

          {/* activity */}
          <div style={{ flex: "1 1 280px", border: "1px solid #13171C", minWidth: 0 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #13171C" }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: "#8A9099" }}>ACTIVITY</span>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {ACTIVITY.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "#3D434B", flex: "none", width: 46 }}>{a.t}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "#8A9099", lineHeight: 1.5 }}>{a.node}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
