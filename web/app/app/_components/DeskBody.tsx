"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Topbar, LiveDot } from "./Topbar";
import { listOrders, type OrderSummary } from "../../_lib/engine";
import { loadDesk } from "../../_lib/desk";
import { shortId, sideColor, statusColor, hhmm } from "../../_lib/ui";

const mono = "'IBM Plex Mono', monospace";

const orderGrid: CSSProperties = { display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr", gap: 12, padding: "14px 20px", fontFamily: mono, fontSize: 12, alignItems: "center" };

function statusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "open": return "● SEALED";
    case "matched": return "● MATCHED";
    case "settled": return "● SETTLED";
    case "cancelled": return "● CANCELLED";
    default: return `● ${status.toUpperCase()}`;
  }
}

export function DeskBody() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // This desk's identity — the Desk view is scoped to orders YOU placed (the
  // global, anonymized book lives on the Pool screen). Read synchronously from
  // the client-only localStorage in a lazy initializer so the desk is scoped on
  // the FIRST render — otherwise the orders fetch could resolve before the pubkey
  // and briefly flash the empty "no orders" state for a desk that has orders.
  const [pubkey] = useState<string | null>(() => loadDesk()?.publicKey ?? null);

  useEffect(() => {
    let alive = true;
    // Pull a generous page of the book, then filter to this desk client-side.
    const tick = () =>
      listOrders(200)
        .then((o) => { if (alive) { setOrders(o); setErr(null); } })
        .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Only this desk's own orders. If the desk key isn't loaded yet, show nothing
  // (rather than the whole market) so two desks never look identical.
  const mine = orders === null || pubkey === null ? null : orders.filter((o) => o.pubkey === pubkey);

  const open = mine?.filter((o) => o.status === "open").length ?? 0;
  const matched = mine?.filter((o) => o.status === "matched").length ?? 0;
  const settled = mine?.filter((o) => o.status === "settled").length ?? 0;
  const total = mine?.length ?? 0;

  const stats = [
    { k: "Open orders", v: String(open), accent: false },
    { k: "Matched", v: String(matched), accent: true },
    { k: "Settled", v: String(settled), accent: false },
    { k: "Total seen", v: String(total), accent: false },
  ];

  return (
    <>
      <Topbar title="Desk" right={<LiveDot label={err ? "RECONNECTING…" : "LIVE"} ok={!err} />} />
      <div style={{ flex: 1, padding: 28 }}>
        {/* Stale-feed banner: once orders have loaded, a later poll failure is
            otherwise invisible (the table keeps showing the last-known book). */}
        {err && mine !== null ? (
          <div style={{ fontFamily: mono, fontSize: 11, color: "#E05A6E", background: "#160E10", border: "1px solid #2A1418", padding: "10px 14px", marginBottom: 18, letterSpacing: "0.03em" }}>
            {`// engine unreachable — showing last-known book, retrying… (${err})`}
          </div>
        ) : null}
        {/* stat row */}
        <div className="nyx-app-stats4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#13171C", border: "1px solid #13171C", marginBottom: 24 }}>
          {stats.map((s) => (
            <div key={s.k} style={{ background: "#07080A", padding: "20px 22px" }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: "#3D434B", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.k}</div>
              <div style={{ fontFamily: mono, fontSize: 26, color: s.accent ? "#3BD7E0" : "#ECEEF0", marginTop: 8 }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* orders */}
          <div style={{ flex: "1.5 1 420px", border: "1px solid #13171C", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #13171C" }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: "#8A9099" }}>ORDERS</span>
              <Link href="/app/compose" style={{ fontFamily: mono, fontSize: 11, color: "#07080A", background: "#3BD7E0", padding: "6px 12px", textDecoration: "none" }}>+ New</Link>
            </div>
            <div style={{ ...orderGrid, padding: "11px 20px", fontSize: 10, letterSpacing: "0.1em", color: "#3D434B", borderBottom: "1px solid #13171C" }}>
              <span>PAIR</span><span>SIDE</span><span>COMMITMENT</span><span style={{ textAlign: "right" }}>STATUS</span>
            </div>
            {mine === null ? (
              <div style={{ padding: "18px 20px", fontFamily: mono, fontSize: 11, color: "#565C64" }}>{err ? `// engine unreachable: ${err}` : "// loading…"}</div>
            ) : mine.length === 0 ? (
              <div style={{ padding: "18px 20px", fontFamily: mono, fontSize: 11, color: "#565C64" }}>{`// no orders from this desk yet — compose one to begin.`}</div>
            ) : (
              mine.map((o, i) => (
                <div key={o.id} style={{ ...orderGrid, borderBottom: i < mine.length - 1 ? "1px solid #0E1115" : "none", background: i % 2 === 1 ? "#0A0C0F" : "transparent" }}>
                  <span style={{ color: "#ECEEF0" }}>{o.asset_pair}</span>
                  <span style={{ color: sideColor(o.side) }}>{o.side.toUpperCase()}</span>
                  <span style={{ color: "#565C64" }}>{shortId(o.commitment)}</span>
                  <span style={{ textAlign: "right", color: statusColor(o.status) }}>{statusLabel(o.status)}</span>
                </div>
              ))
            )}
          </div>

          {/* activity (derived from recent orders) */}
          <div style={{ flex: "1 1 280px", border: "1px solid #13171C", minWidth: 0 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #13171C" }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: "#8A9099" }}>ACTIVITY</span>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {(mine ?? []).slice(0, 6).map((o) => (
                <div key={o.id} style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "#3D434B", flex: "none", width: 46 }}>{hhmm(o.created_at)}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "#8A9099", lineHeight: 1.5 }}>
                    Order <span style={{ color: statusColor(o.status) }}>{shortId(o.id, 4, 4)}</span> {o.status}.
                  </span>
                </div>
              ))}
              {mine !== null && mine.length === 0 ? (
                <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64" }}>{`// quiet desk.`}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
