"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "./Topbar";
import { listOrders, getMatch, type Match, type OrderSummary } from "../../_lib/engine";
import { shortId, hhmm, activeOrderId, explorerTxUrl, statusColor } from "../../_lib/ui";
import { loadDesk } from "../../_lib/desk";

const mono = "'IBM Plex Mono', monospace";
const serif = "'Spectral', serif";
const sans = "'Archivo', sans-serif";

/** Build a settlement receipt and trigger a client-side download. Private price/
 * size stay sealed and are intentionally absent. */
function downloadReceipt(match: Match, order: OrderSummary | null) {
  const desk = loadDesk();
  const receipt = {
    kind: "nyx-settlement-receipt",
    network: "testnet",
    generated_at: new Date().toISOString(),
    desk: desk?.publicKey ?? null,
    order_id: order?.id ?? null,
    asset_pair: order?.asset_pair ?? null,
    match_id: match.id,
    maker_order_id: match.maker_order_id,
    taker_order_id: match.taker_order_id,
    has_proof: match.has_proof,
    onchain_status: match.onchain_status,
    settlement_tx: match.settlement_tx ?? null,
    explorer: match.settlement_tx ? explorerTxUrl(match.settlement_tx) : null,
    note:
      match.onchain_status === "confirmed"
        ? "Price and size are sealed off-chain; the market saw only a verified proof."
        : `Settlement did not confirm on-chain (status: ${match.onchain_status}); price and size remained sealed.`,
  };
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nyx-receipt-${shortId(match.id, 4, 4).replace("…", "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SettledBody() {
  const [match, setMatch] = useState<Match | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [note, setNote] = useState<string>("loading…");

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const id = activeOrderId();
        if (!id) { if (alive) setNote("no active order"); return; }
        const orders = await listOrders(100);
        const mine = orders.find((o) => o.id === id) ?? null;
        if (alive) setOrder(mine);
        if (!mine?.match_id) { if (alive) setNote("not yet matched"); return; }
        const m = await getMatch(mine.match_id);
        if (alive) { setMatch(m); setNote(""); }
      } catch (e) {
        if (alive) setNote(e instanceof Error ? e.message : String(e));
      }
    };
    tick();
    const iv = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const confirmed = match?.onchain_status === "confirmed";
  const failed = match?.onchain_status === "failed";

  return (
    <>
      <Topbar title="Settlement" sub={order ? `/ ${shortId(order.id, 4, 4)}` : undefined} />
      <div style={{ flex: 1, padding: "40px 28px", position: "relative", display: "flex", gap: 32, flexWrap: "wrap" }}>
        <svg width="460" height="460" viewBox="0 0 100 100" style={{ position: "absolute", right: -150, top: 40, opacity: 0.35 }} aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#13171C" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#3BD7E0" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="150 277" transform="rotate(-72 50 50)" />
        </svg>

        {/* receipt */}
        <div style={{ flex: "1.1 1 420px", maxWidth: 520, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 30 }}>
            <svg width="34" height="34" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="40" fill="#0A2E31" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#3BD7E0" strokeWidth="5" strokeLinecap="round" strokeDasharray="168 252" transform="rotate(-62 50 50)" />
            </svg>
            <div>
              <div style={{ fontFamily: serif, fontSize: 32, color: "#ECEEF0", lineHeight: 1 }}>
                {confirmed ? (
                  <>Settled <span style={{ fontStyle: "italic", color: "#3BD7E0" }}>atomically.</span></>
                ) : failed ? (
                  <>Settlement <span style={{ fontStyle: "italic", color: "#E05A6E" }}>failed.</span></>
                ) : (
                  <>Awaiting <span style={{ fontStyle: "italic", color: "#8A9099" }}>settlement.</span></>
                )}
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: "#565C64", marginTop: 8, letterSpacing: "0.08em" }}>
                {match ? `${hhmm(match.created_at)} UTC · match ${shortId(match.id, 4, 4)}` : note}
              </div>
            </div>
          </div>
          <div style={{ border: "1px solid #13171C" }}>
            {[
              ["PAIR", order?.asset_pair ?? "—", "#ECEEF0"],
              ["STATUS", (match?.onchain_status ?? "pending").toUpperCase(), statusColor(match?.onchain_status ?? "pending")],
              ["MAKER", match ? `undisclosed · ${shortId(match.maker_order_id, 4, 4)}` : "—", "#3D434B"],
              ["COUNTERPARTY", match ? `undisclosed · ${shortId(match.taker_order_id, 4, 4)}` : "—", "#3D434B"],
            ].map(([k, v, c], i, arr) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "18px 22px", borderBottom: i < arr.length - 1 ? "1px solid #13171C" : "none" }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64", letterSpacing: "0.08em" }}>{k}</span>
                <span style={{ fontFamily: mono, fontSize: 14, color: c }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: "#565C64", lineHeight: 1.7, marginTop: 18 }}>
            {`// price & size are known only to the two desks.`}<br />{`// the market saw only a verified proof.`}
          </div>
        </div>

        {/* proof / explorer */}
        <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 18, position: "relative", maxWidth: 380 }}>
          <div style={{ border: "1px solid #13171C", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: confirmed ? "#3BD7E0" : failed ? "#E05A6E" : "#565C64" }} />
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", color: confirmed ? "#3BD7E0" : failed ? "#E05A6E" : "#565C64" }}>{confirmed ? "PROOF VERIFIED" : failed ? "VERIFICATION FAILED" : "PENDING"}</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Settlement tx</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: "#ECEEF0", wordBreak: "break-all", lineHeight: 1.6 }}>{match?.settlement_tx ? shortId(match.settlement_tx, 10, 8) : "—"}</div>
            {match?.settlement_tx ? (
              <a
                href={explorerTxUrl(match.settlement_tx)}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", marginTop: 18, border: "1px solid #23272E", padding: 11, textAlign: "center", fontFamily: mono, fontSize: 11, color: "#ECEEF0", letterSpacing: "0.06em", textDecoration: "none" }}
              >
                View on Stellar Explorer →
              </a>
            ) : (
              <Link href="/app/proofs" style={{ display: "block", marginTop: 18, border: "1px solid #23272E", padding: 11, textAlign: "center", fontFamily: mono, fontSize: 11, color: "#8A9099", letterSpacing: "0.06em", textDecoration: "none" }}>
                ← Back to proof pipeline
              </Link>
            )}
          </div>
          <div style={{ border: "1px solid #13171C", padding: 20 }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Disclosed to market</div>
            <div style={{ fontFamily: serif, fontSize: 30, color: "#3BD7E0" }}>0 bytes</div>
          </div>
          <button
            type="button"
            onClick={() => match && downloadReceipt(match, order)}
            disabled={!match}
            style={{ background: match ? "#3BD7E0" : "#0E7E86", color: "#07080A", fontFamily: sans, fontWeight: 600, fontSize: 14, padding: 15, textAlign: "center", letterSpacing: "0.02em", border: "none", cursor: match ? "pointer" : "default" }}
          >
            Download receipt
          </button>
        </div>
      </div>
    </>
  );
}
