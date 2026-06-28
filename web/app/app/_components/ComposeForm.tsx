"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { seal, type Sealed } from "../../_lib/seal";
import { createOrder } from "../../_lib/engine";
import { loadDesk, signCommitment } from "../../_lib/desk";
import { setActiveOrder } from "../../_lib/ui";

const mono = "'IBM Plex Mono', monospace";
const sans = "'Archivo', sans-serif";

// The order's pubkey is the authenticated desk's Stellar G-address (set at
// /app/access); the engine treats asset_pair as an opaque string, and both
// sides of a match must share the exact same asset_pair. The matcher only
// crosses orders on the *same* pair — so a manual two-desk cross requires both
// desks to pick the same pair here.
const PAIRS = ["US-TBILL-26/USDC", "US-TBILL-27/USDC", "EU-BUND-30/USDC", "GOLD-RWA/USDC"] as const;

/** Shorten a long decimal commitment for display. */
function short(dec: string): string {
  if (dec.length <= 18) return dec;
  return `${dec.slice(0, 10)}…${dec.slice(-8)}`;
}

const label: CSSProperties = { fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", color: "#3D434B", textTransform: "uppercase", marginBottom: 9 };
const field: CSSProperties = { border: "1px solid #15181D", background: "#0A0C0F", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const input: CSSProperties = { background: "transparent", border: "none", outline: "none", color: "#ECEEF0", fontFamily: mono, fontSize: 15, width: "100%" };
const unit: CSSProperties = { fontFamily: mono, fontSize: 12, color: "#3D434B" };

type Side = "BID" | "ASK";
type Tif = "GTC" | "IOC" | "1H";

export function ComposeForm() {
  const router = useRouter();
  const [pair, setPair] = useState<string>(PAIRS[0]);
  const [side, setSide] = useState<Side>("BID");
  const [tif, setTif] = useState<Tif>("GTC");
  const [price, setPrice] = useState("99.84");
  const [size, setSize] = useState("5,000,000");

  // Live local seal: recompute the real Poseidon commitment whenever the inputs
  // change. The same sealed object is what we broadcast, so the preview matches
  // exactly what the engine receives.
  const [sealed, setSealed] = useState<Sealed | null>(null);
  const [sealErr, setSealErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  // Atomic in-flight guard: `busy` state updates async, so a rapid double-click
  // could fire two broadcasts (the 2nd reusing the same commitment → a 409). A
  // ref flips synchronously and blocks the duplicate.
  const busyRef = useRef(false);

  useEffect(() => {
    let alive = true;
    seal(price, size)
      .then((s) => {
        if (alive) {
          setSealed(s);
          setSealErr(null);
        }
      })
      .catch((e) => {
        if (alive) {
          setSealed(null);
          setSealErr(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      alive = false;
    };
  }, [price, size]);

  async function broadcast() {
    if (!sealed || busyRef.current) return;
    busyRef.current = true;
    const desk = loadDesk();
    if (!desk) {
      busyRef.current = false;
      setSubmitErr("no desk identity — re-authenticate");
      return;
    }
    setBusy(true);
    setSubmitErr(null);
    try {
      const { id } = await createOrder({
        pubkey: desk.publicKey,
        asset_pair: pair,
        side: side === "BID" ? "bid" : "ask",
        price: sealed.priceInt,
        volume: sealed.volumeInt,
        salt: sealed.salt,
        commitment: sealed.commitment,
        nullifier: sealed.nullifier,
        signature: signCommitment(desk, sealed.commitment),
      });
      // Persist the active order with its private integers so the demo-mode
      // counterparty can mirror price/volume (which the API never returns).
      setActiveOrder({
        id,
        side: side === "BID" ? "bid" : "ask",
        pair,
        priceInt: sealed.priceInt,
        volumeInt: sealed.volumeInt,
      });
      router.push(`/app/pool?order=${encodeURIComponent(id)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // A nullifier collision means this exact order was already accepted — guide
      // the user to the pool instead of showing a scary "broadcast failed".
      setSubmitErr(/nullifier/i.test(msg) ? "already broadcast — view it in the pool" : msg);
      setBusy(false);
      busyRef.current = false;
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, flexWrap: "wrap" }}>
      {/* form */}
      <div style={{ flex: "1.2 1 360px", padding: 28, borderRight: "1px solid #13171C", display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={label}>Pair</div>
          <div style={{ ...field, padding: 0 }}>
            <select
              aria-label="Asset pair"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              style={{
                appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                background: "transparent", border: "none", outline: "none",
                color: "#ECEEF0", fontFamily: sans, fontWeight: 600, fontSize: 15,
                width: "100%", padding: "14px 16px", cursor: "pointer",
                // arrow drawn as an inline SVG background so it tracks the brand colour
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23565C64' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 16px center",
              }}
            >
              {PAIRS.map((p) => (
                <option key={p} value={p} style={{ background: "#0A0C0F", color: "#ECEEF0" }}>
                  {p.replace("/", " / ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div style={label}>Side</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#15181D", border: "1px solid #15181D" }}>
            <button
              type="button"
              onClick={() => setSide("BID")}
              style={{
                background: side === "BID" ? "#0F2A1F" : "#0A0C0F",
                color: side === "BID" ? "#43C08A" : "#565C64",
                padding: 13, textAlign: "center", fontFamily: mono, fontSize: 13, letterSpacing: "0.1em",
                border: "none", cursor: "pointer",
              }}
            >
              BID · BUY
            </button>
            <button
              type="button"
              onClick={() => setSide("ASK")}
              style={{
                background: side === "ASK" ? "#2A1418" : "#0A0C0F",
                color: side === "ASK" ? "#E05A6E" : "#565C64",
                padding: 13, textAlign: "center", fontFamily: mono, fontSize: 13, letterSpacing: "0.1em",
                border: "none", cursor: "pointer",
              }}
            >
              ASK · SELL
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px" }}>
            <div style={label}>Limit price</div>
            <div style={field}>
              <input aria-label="Limit price" value={price} onChange={(e) => setPrice(e.target.value)} style={input} inputMode="decimal" />
              <span style={unit}>USDC</span>
            </div>
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <div style={label}>Size</div>
            <div style={field}>
              <input aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)} style={input} />
              <span style={unit}>units</span>
            </div>
          </div>
        </div>

        <div>
          <div style={label}>Time in force</div>
          <div style={{ display: "flex", gap: 10 }}>
            {(["GTC", "IOC", "1H"] as Tif[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTif(t)}
                style={{
                  border: `1px solid ${tif === t ? "#3BD7E0" : "#15181D"}`,
                  color: tif === t ? "#3BD7E0" : "#565C64",
                  background: "transparent",
                  fontFamily: mono, fontSize: 11, padding: "8px 14px", cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* seal preview */}
      <div style={{ flex: "1 1 320px", padding: 28, display: "flex", flexDirection: "column", background: "#0A0C0F" }}>
        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", color: "#8A9099", marginBottom: 20 }}>SEAL PREVIEW</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <svg width="16" height="16" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#3BD7E0" strokeWidth="8" strokeLinecap="round" strokeDasharray="168 252" transform="rotate(-62 50 50)" />
          </svg>
          <span style={{ fontFamily: mono, fontSize: 11, color: "#3BD7E0", letterSpacing: "0.08em" }}>SEALED LOCALLY · NOT YET BROADCAST</span>
        </div>
        <div style={{ border: "1px solid #15181D", padding: 18, marginBottom: 18 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Poseidon commitment</div>
          <div style={{ fontFamily: mono, fontSize: 12, color: sealErr ? "#E05A6E" : "#3BD7E0", wordBreak: "break-all", lineHeight: 1.6 }}>
            {sealErr ? `// ${sealErr}` : sealed ? short(sealed.commitment) : "computing…"}
          </div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: "#565C64", lineHeight: 1.7, marginBottom: "auto" }}>
          {`// ${side} ${size} @ ${price} — price & size never leave this device.`}
          <br />
          {`// the network only ever sees this hash · TIF ${tif}.`}
          <br />
          {`// full-fill model — a counter must match this exact size to cross.`}
        </div>
        {submitErr ? (
          <div style={{ fontFamily: mono, fontSize: 11, color: "#E05A6E", lineHeight: 1.6, marginTop: 14 }}>
            {`// broadcast failed: ${submitErr}`}
          </div>
        ) : null}
        <button
          type="button"
          onClick={broadcast}
          disabled={!sealed || busy}
          style={{
            background: !sealed || busy ? "#0E7E86" : "#3BD7E0",
            color: "#07080A", fontFamily: sans, fontWeight: 600, fontSize: 14, padding: 15,
            textAlign: "center", letterSpacing: "0.02em", border: "none",
            cursor: !sealed || busy ? "default" : "pointer", marginTop: 18,
          }}
        >
          {busy ? "Broadcasting…" : "Seal & broadcast →"}
        </button>
      </div>
    </div>
  );
}
