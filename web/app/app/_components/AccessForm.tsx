"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createDesk, importDesk, loadDesk, saveDesk, clearDesk, type Desk } from "../../_lib/desk";
import { shortId } from "../../_lib/ui";

const mono = "'IBM Plex Mono', monospace";
const sans = "'Archivo', sans-serif";

const field: CSSProperties = { marginTop: 14, border: "1px solid #15181D", background: "#0A0C0F", padding: 10, display: "flex", alignItems: "center", gap: 10 };
const tag: CSSProperties = { fontFamily: mono, fontSize: 11, color: "#3D434B", paddingLeft: 6, flex: "none" };
const val: CSSProperties = { flex: 1, textAlign: "left", fontFamily: mono, fontSize: 13, color: "#8A9099", letterSpacing: "0.02em", wordBreak: "break-all" };
const cta: CSSProperties = { display: "block", width: "100%", marginTop: 14, background: "#3BD7E0", color: "#07080A", fontFamily: sans, fontWeight: 600, fontSize: 14, padding: 14, letterSpacing: "0.02em", border: "none", cursor: "pointer" };

type Mode = "generate" | "import";

export function AccessForm() {
  const router = useRouter();
  const [existing, setExisting] = useState<Desk | null>(null);
  const [mode, setMode] = useState<Mode>("generate");
  const [generated, setGenerated] = useState<Desk | null>(null);
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // On mount: if a desk already exists, offer to continue; else pre-generate one.
  useEffect(() => {
    const d = loadDesk();
    if (d) setExisting(d);
    else setGenerated(createDesk("Desk"));
  }, []);

  function authenticate(desk: Desk) {
    if (!saveDesk(desk)) {
      // Storage blocked (Safari private mode, disabled site data, quota). Without
      // this guard the push to /app would loop straight back through AuthGate.
      setErr("Storage is blocked. Enable cookies / site data for this site to sign in.");
      return;
    }
    router.push("/app");
  }

  // One error line, shown in every mode (generate / continue / import).
  const errLine = err ? (
    <div style={{ fontFamily: mono, fontSize: 11, color: "#E05A6E", marginTop: 10, textAlign: "left" }}>{`// ${err}`}</div>
  ) : null;

  function regenerate() {
    setGenerated(createDesk("Desk"));
    setErr(null);
  }

  function authenticateImport() {
    try {
      authenticate(importDesk("Desk", secret));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  // Already authenticated → continue or switch.
  if (existing) {
    return (
      <div>
        <div style={field}>
          <span style={tag}>DESK</span>
          <span style={{ ...val, color: "#3BD7E0" }}>{shortId(existing.publicKey, 8, 6)}</span>
        </div>
        <button type="button" style={cta} onClick={() => authenticate(existing)}>
          Continue as {shortId(existing.publicKey, 4, 4)} →
        </button>
        <button
          type="button"
          onClick={() => { clearDesk(); setExisting(null); setGenerated(createDesk("Desk")); setMode("generate"); }}
          style={{ display: "block", width: "100%", marginTop: 10, background: "transparent", color: "#565C64", fontFamily: mono, fontSize: 11, padding: 8, border: "none", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          Use a different key
        </button>
        {errLine}
      </div>
    );
  }

  return (
    <div>
      {/* mode toggle */}
      <div style={{ display: "flex", gap: 1, background: "#15181D", border: "1px solid #15181D", marginBottom: 4 }}>
        {(["generate", "import"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setErr(null); }}
            style={{ flex: 1, background: mode === m ? "#0A0C0F" : "transparent", color: mode === m ? "#3BD7E0" : "#565C64", fontFamily: mono, fontSize: 11, padding: 10, border: "none", cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            {m === "generate" ? "Generate key" : "Import key"}
          </button>
        ))}
      </div>

      {mode === "generate" ? (
        <>
          <div style={field}>
            <span style={tag}>PUB</span>
            <span style={{ ...val, color: "#3BD7E0" }}>{generated ? shortId(generated.publicKey, 10, 8) : "…"}</span>
          </div>
          <div style={field}>
            <span style={tag}>SEC</span>
            <span style={val}>{generated ? shortId(generated.secret, 6, 4) : "…"}</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, color: "#565C64", lineHeight: 1.6, marginTop: 10, textAlign: "left" }}>
            {`// a throwaway Stellar keypair · your desk identity.`}<br />
            {`// it signs every order; the engine verifies it on-chain-grade.`}
          </div>
          <button type="button" style={cta} onClick={() => generated && authenticate(generated)} disabled={!generated}>
            Authenticate with new key →
          </button>
          {errLine}
          <button
            type="button"
            onClick={regenerate}
            style={{ display: "block", width: "100%", marginTop: 10, background: "transparent", color: "#565C64", fontFamily: mono, fontSize: 11, padding: 8, border: "none", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Regenerate
          </button>
        </>
      ) : (
        <>
          <div style={field}>
            <span style={tag}>SEC</span>
            <input
              aria-label="Stellar secret key"
              value={secret}
              onChange={(e) => { setSecret(e.target.value); setErr(null); }}
              placeholder="S..."
              spellCheck={false}
              style={{ ...val, background: "transparent", border: "none", outline: "none", color: "#ECEEF0" }}
            />
          </div>
          {errLine}
          <button type="button" style={cta} onClick={authenticateImport} disabled={!secret.trim()}>
            Authenticate with signed key →
          </button>
        </>
      )}
    </div>
  );
}
