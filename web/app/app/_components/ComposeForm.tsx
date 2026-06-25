"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";

const mono = "'IBM Plex Mono', monospace";
const sans = "'Archivo', sans-serif";

const label: CSSProperties = { fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", color: "#3D434B", textTransform: "uppercase", marginBottom: 9 };
const field: CSSProperties = { border: "1px solid #15181D", background: "#0A0C0F", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const input: CSSProperties = { background: "transparent", border: "none", outline: "none", color: "#ECEEF0", fontFamily: mono, fontSize: 15, width: "100%" };
const unit: CSSProperties = { fontFamily: mono, fontSize: 12, color: "#3D434B" };

type Side = "BID" | "ASK";
type Tif = "GTC" | "IOC" | "1H";

export function ComposeForm() {
  const [side, setSide] = useState<Side>("BID");
  const [tif, setTif] = useState<Tif>("GTC");
  const [price, setPrice] = useState("99.84");
  const [size, setSize] = useState("5,000,000");

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, flexWrap: "wrap" }}>
      {/* form */}
      <div style={{ flex: "1.2 1 360px", padding: 28, borderRight: "1px solid #13171C", display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={label}>Pair</div>
          <div style={field}>
            <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 15, color: "#ECEEF0" }}>US-TBILL-26 / USDC</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64" }}>▾</span>
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
          <div style={{ fontFamily: mono, fontSize: 12, color: "#3BD7E0", wordBreak: "break-all", lineHeight: 1.6 }}>0x9f3a8e21c40d77be5a1f0c2294ad6f88e1b7c204</div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: "#565C64", lineHeight: 1.7, marginBottom: "auto" }}>
          {`// ${side} ${size} @ ${price} — price & size never leave this device.`}
          <br />
          {`// the network only ever sees this hash · TIF ${tif}.`}
        </div>
        <Link
          href="/app/pool"
          style={{ background: "#3BD7E0", color: "#07080A", fontFamily: sans, fontWeight: 600, fontSize: 14, padding: 15, textAlign: "center", letterSpacing: "0.02em", textDecoration: "none", marginTop: 18 }}
        >
          Seal &amp; broadcast →
        </Link>
      </div>
    </div>
  );
}
