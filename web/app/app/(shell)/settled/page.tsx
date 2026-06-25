import type { Metadata } from "next";
import { Topbar } from "../../_components/Topbar";

export const metadata: Metadata = { title: "Nyx — Settlement" };

const mono = "'IBM Plex Mono', monospace";
const serif = "'Spectral', serif";
const sans = "'Archivo', sans-serif";

const RECEIPT: [string, string, string][] = [
  ["YOU RECEIVED", "5,000,000 TBILL-26", "#43C08A"],
  ["YOU SENT", "4,992,000 USDC", "#E05A6E"],
  ["FILL PRICE", "99.84", "#ECEEF0"],
  ["COUNTERPARTY", "undisclosed · #4392", "#3D434B"],
];

export default function Settled() {
  return (
    <>
      <Topbar title="Settlement" sub="/ #4471" />
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
              <div style={{ fontFamily: serif, fontSize: 32, color: "#ECEEF0", lineHeight: 1 }}>Settled <span style={{ fontStyle: "italic", color: "#3BD7E0" }}>atomically.</span></div>
              <div style={{ fontFamily: mono, fontSize: 11, color: "#565C64", marginTop: 8, letterSpacing: "0.08em" }}>14:22:11 UTC · ledger 58,204,118</div>
            </div>
          </div>
          <div style={{ border: "1px solid #13171C" }}>
            {RECEIPT.map(([k, v, c], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "18px 22px", borderBottom: i < RECEIPT.length - 1 ? "1px solid #13171C" : "none" }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64", letterSpacing: "0.08em" }}>{k}</span>
                <span style={{ fontFamily: mono, fontSize: i === RECEIPT.length - 1 ? 13 : 15, color: c }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: "#565C64", lineHeight: 1.7, marginTop: 18 }}>
            {`// the fill is visible to the two desks.`}<br />{`// the market saw only a verified proof.`}
          </div>
        </div>

        {/* proof / explorer */}
        <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 18, position: "relative", maxWidth: 380 }}>
          <div style={{ border: "1px solid #13171C", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3BD7E0" }} />
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", color: "#3BD7E0" }}>PROOF VERIFIED</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>Settlement tx</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: "#ECEEF0", wordBreak: "break-all", lineHeight: 1.6 }}>0x5a27be83…07fa1c39</div>
            <a
              href="https://stellar.expert/explorer/public"
              target="_blank"
              rel="noreferrer"
              style={{ display: "block", marginTop: 18, border: "1px solid #23272E", padding: 11, textAlign: "center", fontFamily: mono, fontSize: 11, color: "#ECEEF0", letterSpacing: "0.06em", textDecoration: "none" }}
            >
              View on Stellar Explorer →
            </a>
          </div>
          <div style={{ border: "1px solid #13171C", padding: 20 }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Disclosed to market</div>
            <div style={{ fontFamily: serif, fontSize: 30, color: "#3BD7E0" }}>0 bytes</div>
          </div>
          {/* download receipt — real button; export logic pending */}
          <button
            type="button"
            style={{ background: "#3BD7E0", color: "#07080A", fontFamily: sans, fontWeight: 600, fontSize: 14, padding: 15, textAlign: "center", letterSpacing: "0.02em", border: "none", cursor: "pointer" }}
          >
            Download receipt
          </button>
        </div>
      </div>
    </>
  );
}
