"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "./Topbar";
import { listOrders, getMatch, type Match } from "../../_lib/engine";
import { shortId, activeOrderId } from "../../_lib/ui";

const mono = "'IBM Plex Mono', monospace";
const serif = "'Spectral', serif";

type IconKind = "done" | "spin" | "idle" | "fail";
interface Stage { title: string; sub: string; tag: string; tagC: string; icon: IconKind; bg: string; subC?: string; dim?: boolean }

function DoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="40" fill="#0F2A1F" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#43C08A" strokeWidth="5" />
    </svg>
  );
}
function FailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="40" fill="#2A1418" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#E05A6E" strokeWidth="5" />
    </svg>
  );
}

function buildStages(match: Match | null): Stage[] {
  const located = match != null;
  const proven = match?.has_proof ?? false;
  const oc = match?.onchain_status ?? "pending";
  const confirmed = oc === "confirmed";
  const failed = oc === "failed";

  const done = (sub: string): Stage => ({ title: "", sub, tag: "DONE", tagC: "#43C08A", icon: "done", bg: "transparent" });

  return [
    located
      ? { ...done("maker ∩ taker located"), title: "Match located" }
      : { title: "Match located", sub: "searching the pool", tag: "WAITING", tagC: "#3BD7E0", icon: "spin", bg: "#0A0C0F", subC: "#3BD7E0" },
    proven
      ? { ...done("intersection at valid px & volume"), title: "ZK proof generated" }
      : { title: "ZK proof generated", sub: located ? "generating Groth16 witness…" : "awaiting match", tag: located ? "ACTIVE" : "PENDING", tagC: located ? "#3BD7E0" : "#565C64", icon: located ? "spin" : "idle", bg: located ? "#0A0C0F" : "transparent", subC: located ? "#3BD7E0" : undefined, dim: !located },
    confirmed
      ? { ...done("Soroban · BN254 host fn"), title: "Verifying on-chain" }
      : failed
        ? { title: "Verifying on-chain", sub: "verification failed", tag: "FAILED", tagC: "#E05A6E", icon: "fail", bg: "transparent" }
        : { title: "Verifying on-chain", sub: "Soroban · BN254 host fn", tag: proven ? "ACTIVE" : "PENDING", tagC: proven ? "#3BD7E0" : "#565C64", icon: proven ? "spin" : "idle", bg: proven ? "#0A0C0F" : "transparent", subC: proven ? "#3BD7E0" : undefined, dim: !proven },
    confirmed
      ? { ...done("RWA ⇄ USDC"), title: "Atomic settlement" }
      : failed
        ? { title: "Atomic settlement", sub: "not settled", tag: "FAILED", tagC: "#E05A6E", icon: "fail", bg: "transparent" }
        : { title: "Atomic settlement", sub: "RWA ⇄ USDC", tag: "PENDING", tagC: "#565C64", icon: "idle", bg: "transparent", dim: true },
  ];
}

export function ProofsBody() {
  const [match, setMatch] = useState<Match | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [note, setNote] = useState<string>("locating match…");

  useEffect(() => {
    setActiveId(activeOrderId());
    let alive = true;
    const tick = async () => {
      try {
        const id = activeOrderId();
        if (!id) { if (alive) setNote("no active order"); return; }
        const orders = await listOrders(100);
        const mine = orders.find((o) => o.id === id);
        if (!mine) { if (alive) setNote("order not found"); return; }
        if (!mine.match_id) { if (alive) { setMatch(null); setNote("waiting for a crossing order…"); } return; }
        const m = await getMatch(mine.match_id);
        if (alive) { setMatch(m); setNote(""); }
      } catch (e) {
        if (alive) setNote(e instanceof Error ? e.message : String(e));
      }
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const stages = buildStages(match);
  const headerFound = match != null;

  return (
    <>
      <Topbar title="Match" sub={activeId ? `/ order ${shortId(activeId, 4, 4)}` : undefined} />
      <div style={{ flex: 1, padding: 28, display: "flex", gap: 24, minHeight: 0, flexWrap: "wrap" }}>
        {/* pipeline */}
        <div style={{ flex: "1.3 1 360px", border: "1px solid #13171C", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid #13171C", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: headerFound ? "#43C08A" : "#3BD7E0" }} />
            <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", color: headerFound ? "#43C08A" : "#3BD7E0" }}>
              {headerFound ? "MATCH FOUND" : (note || "SEARCHING").toUpperCase()}
            </span>
          </div>
          <div style={{ padding: "8px 0", flex: 1 }}>
            {stages.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", borderTop: i > 0 ? "1px solid #0E1115" : "none", background: s.bg, opacity: s.dim ? 0.5 : 1 }}>
                {s.icon === "done" ? <DoneIcon /> : s.icon === "fail" ? <FailIcon /> : s.icon === "spin" ? (
                  <svg width="18" height="18" viewBox="0 0 50 50" style={{ animation: "nyxSpin 1.4s linear infinite" }} aria-hidden="true">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="#15181D" strokeWidth="5" />
                    <circle cx="25" cy="25" r="20" fill="none" stroke="#3BD7E0" strokeWidth="5" strokeLinecap="round" strokeDasharray="40 86" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#23272E" strokeWidth="5" /></svg>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: serif, fontSize: 17, color: "#ECEEF0" }}>{s.title}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: s.subC ?? "#565C64", marginTop: 3 }}>{s.sub}</div>
                </div>
                <span style={{ fontFamily: mono, fontSize: 10, color: s.tagC }}>{s.tag}</span>
              </div>
            ))}
          </div>
        </div>

        {/* artifact / on-chain */}
        <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <div style={{ border: "1px solid #13171C", padding: 20 }}>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", color: "#8A9099", marginBottom: 16 }}>PROOF ARTIFACT</div>
            {[
              ["System", "Groth16 · BN254", "#ECEEF0"],
              ["Public inputs", "2 commitments", "#ECEEF0"],
              ["Proof", match?.has_proof ? "stored ✓" : "—", match?.has_proof ? "#3BD7E0" : "#565C64"],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 13 }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64" }}>{k}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: c as string }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ border: "1px solid #13171C", padding: 20, flex: 1 }}>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", color: "#8A9099", marginBottom: 16 }}>ON-CHAIN</div>
            {[
              ["Status", match?.onchain_status ?? "—"],
              ["Settlement tx", match?.settlement_tx ? shortId(match.settlement_tx, 6, 6) : "—"],
              ["Host fn", "bn254_pairing"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 13 }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64" }}>{k}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: "#ECEEF0" }}>{v}</span>
              </div>
            ))}
            {match?.onchain_status === "confirmed" ? (
              <Link href="/app/settled" style={{ display: "block", marginTop: 16, border: "1px solid #23272E", padding: 11, textAlign: "center", fontFamily: mono, fontSize: 11, color: "#3BD7E0", letterSpacing: "0.06em", textDecoration: "none" }}>
                View settlement →
              </Link>
            ) : (
              <div style={{ marginTop: 20, fontFamily: mono, fontSize: 11, color: "#565C64", lineHeight: 1.7 }}>
                {`// neither desk learns the other's`}<br />{`// price or size — only that it cleared.`}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
