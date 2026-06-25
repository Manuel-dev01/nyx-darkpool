import type { Metadata } from "next";
import { Topbar } from "../../_components/Topbar";

export const metadata: Metadata = { title: "Nyx — Proofs" };

const mono = "'IBM Plex Mono', monospace";
const serif = "'Spectral', serif";

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="40" fill="#0F2A1F" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#43C08A" strokeWidth="5" />
    </svg>
  );
}

const STAGES = [
  { title: "Match located", sub: "maker #4392 ∩ taker #4471", tag: "DONE", tagC: "#43C08A", icon: "done", bg: "transparent" },
  { title: "ZK proof generated", sub: "intersection at valid px & volume", tag: "DONE", tagC: "#43C08A", icon: "done", bg: "transparent" },
  { title: "Verifying on-chain", sub: "Soroban · BN254 host fn", tag: "ACTIVE", tagC: "#3BD7E0", icon: "spin", bg: "#0A0C0F", subC: "#3BD7E0" },
  { title: "Atomic settlement", sub: "RWA ⇄ USDC", tag: "PENDING", tagC: "#565C64", icon: "idle", bg: "transparent", dim: true },
];

export default function Proofs() {
  return (
    <>
      <Topbar title="Match" sub="/ order #4471 × #4392" />
      <div style={{ flex: 1, padding: 28, display: "flex", gap: 24, minHeight: 0, flexWrap: "wrap" }}>
        {/* pipeline */}
        <div style={{ flex: "1.3 1 360px", border: "1px solid #13171C", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid #13171C", display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#43C08A" }} />
            <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", color: "#43C08A" }}>MATCH FOUND</span>
          </div>
          <div style={{ padding: "8px 0", flex: 1 }}>
            {STAGES.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", borderTop: i > 0 ? "1px solid #0E1115" : "none", background: s.bg, opacity: s.dim ? 0.5 : 1 }}>
                {s.icon === "done" ? (
                  <Check />
                ) : s.icon === "spin" ? (
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
              ["Proof", "0x7e1c…b9a4", "#3BD7E0"],
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
              ["Contract", "CNYX…verify"],
              ["Ledger", "58,204,117"],
              ["Host fn", "bn254_pairing"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 13 }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#565C64" }}>{k}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: "#ECEEF0" }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 20, fontFamily: mono, fontSize: 11, color: "#565C64", lineHeight: 1.7 }}>
              {`// neither desk learns the other's`}<br />{`// price or size — only that it cleared.`}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
