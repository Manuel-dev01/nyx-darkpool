"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "./Topbar";
import { listOrders, type OrderSummary } from "../../_lib/engine";
import { shortId, sideColor, activeOrderId } from "../../_lib/ui";

const mono = "'IBM Plex Mono', monospace";
const sans = "'Archivo', sans-serif";

function Searching({ found }: { found: boolean }) {
  if (found) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#43C08A" }} />
        <span style={{ fontFamily: mono, fontSize: 11, color: "#43C08A", letterSpacing: "0.1em" }}>MATCH FOUND</span>
      </div>
    );
  }
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

const CELLS = 80;

export function PoolBody() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(activeOrderId());
    let alive = true;
    const tick = () =>
      listOrders(100)
        .then((o) => { if (alive) setOrders(o); })
        .catch(() => { /* keep last good */ });
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const open = (orders ?? []).filter((o) => o.status === "open");
  const active = (orders ?? []).find((o) => o.id === activeId) ?? null;
  const found = active != null && active.status !== "open";
  const lit = Math.min(open.length, CELLS - 1);

  return (
    <>
      <Topbar title="Pool" sub={active ? `/ order ${shortId(active.id, 4, 4)}` : undefined} right={<Searching found={found} />} />
      <div style={{ flex: 1, display: "flex", minHeight: 0, flexWrap: "wrap" }}>
        {/* lattice */}
        <div style={{ flex: "1.4 1 420px", padding: 32, borderRight: "1px solid #13171C", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: "#8A9099", marginBottom: 8 }}>SHIELDED POOL</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: "#3D434B", marginBottom: 24 }}>
            {orders === null ? "connecting…" : `${open.length} resting commitments · prices & sizes hidden`}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(16,1fr)", gridAutoRows: "1fr", gap: 11, alignContent: "start" }}>
            {Array.from({ length: CELLS }).map((_, i) => {
              const isMatch = found && i === Math.min(lit, CELLS - 1);
              return (
                <span
                  key={i}
                  style={
                    isMatch
                      ? { aspectRatio: "1", border: "1.5px solid #3BD7E0", background: "#0A2E31", animation: "nyxPulse 1.8s ease-in-out infinite" }
                      : { aspectRatio: "1", background: i < lit ? "#3BD7E0" : "#1A1E24" }
                  }
                />
              );
            })}
          </div>
        </div>

        {/* order detail */}
        <div style={{ flex: "1 1 300px", padding: 28, display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: "#8A9099" }}>YOUR ORDER</div>
          {active ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { k: "Pair", v: <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 14, color: "#ECEEF0" }}>{active.asset_pair}</span> },
                  { k: "Side", v: <span style={{ fontFamily: mono, fontSize: 13, color: sideColor(active.side) }}>{active.side.toUpperCase()}</span> },
                  { k: "Price / Size", v: <span style={{ fontFamily: mono, fontSize: 13, color: "#3D434B" }}>•••• · sealed</span> },
                  { k: "Status", v: <span style={{ fontFamily: mono, fontSize: 13, color: found ? "#43C08A" : "#ECEEF0" }}>{active.status.toUpperCase()}</span> },
                ].map((r) => (
                  <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64" }}>{r.k}</span>
                    {r.v}
                  </div>
                ))}
              </div>
              <div style={{ border: "1px solid #15181D", padding: 16 }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Commitment</div>
                <div style={{ fontFamily: mono, fontSize: 12, color: "#3BD7E0", wordBreak: "break-all", lineHeight: 1.5 }}>{shortId(active.commitment, 10, 8)}</div>
              </div>
              {found ? (
                <Link href="/app/proofs" style={{ background: "#3BD7E0", color: "#07080A", fontFamily: sans, fontWeight: 600, fontSize: 13, padding: 13, textAlign: "center", textDecoration: "none" }}>
                  View proof →
                </Link>
              ) : (
                <div style={{ fontFamily: mono, fontSize: 11, color: "#565C64", lineHeight: 1.7, marginTop: "auto" }}>
                  {`// counterparties see only your hash.`}<br />{`// a crossing order triggers proof generation.`}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontFamily: mono, fontSize: 12, color: "#565C64", lineHeight: 1.7 }}>
              {`// no active order.`}<br />
              <Link href="/app/compose" style={{ color: "#3BD7E0", textDecoration: "none" }}>compose & seal one →</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
