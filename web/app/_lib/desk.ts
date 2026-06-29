// Desk identity: a real Stellar ed25519 keypair that authenticates the desk and
// signs its orders. The engine verifies the signature against the order pubkey
// (the desk's G-address) — see engine/internal/stellarkey.
//
// SECURITY NOTE: for this client-only demo the secret seed (S...) is kept in
// localStorage so the browser can sign orders. That is a deliberate, documented
// seam — a real deployment would sign via a wallet extension (Freighter) and
// never expose the secret. Treat generated desks as throwaway.

import { Keypair, StrKey } from "@stellar/stellar-base";
import { Buffer } from "buffer";

const KEY = "nyx.desk";

export interface Desk {
  label: string;
  publicKey: string; // G... address (the order pubkey)
  secret: string; // S... seed (held locally — see note above)
}

export function loadDesk(): Desk | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Desk;
    if (!d || !d.publicKey || !d.secret) return null;
    // Validate it's a real keypair, not just structurally present. A corrupted /
    // hand-edited / partially-written value would otherwise pass AuthGate and then
    // throw at sign time (Keypair.fromSecret) with a confusing broadcast error and
    // no route back to re-authenticate. Reject it here so AuthGate redirects cleanly.
    if (!StrKey.isValidEd25519SecretSeed(d.secret)) return null;
    if (!StrKey.isValidEd25519PublicKey(d.publicKey)) return null;
    return d;
  } catch {
    return null;
  }
}

/** Persist the desk. Returns false if the write failed (storage disabled / quota /
 * private mode) so the caller can surface it instead of silently looping through
 * AuthGate back to /app/access. */
export function saveDesk(d: Desk): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false; // storage disabled — caller must surface this
  }
}

export function clearDesk(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Create a fresh random desk keypair. */
export function createDesk(label: string): Desk {
  const kp = Keypair.random();
  return { label: label.trim() || "Desk", publicKey: kp.publicKey(), secret: kp.secret() };
}

/** Import a desk from an existing Stellar secret seed (S...). Throws if invalid. */
export function importDesk(label: string, secret: string): Desk {
  const s = secret.trim();
  if (!StrKey.isValidEd25519SecretSeed(s)) {
    throw new Error("Not a valid Stellar secret key (S...)");
  }
  const kp = Keypair.fromSecret(s);
  return { label: label.trim() || "Desk", publicKey: kp.publicKey(), secret: s };
}

/** Sign a commitment (decimal string) with the desk key → base64 ed25519 sig.
 * The signed bytes are the commitment's UTF-8 bytes, matching the engine's
 * stellarkey.Verify([]byte(commitment), sig). */
export function signCommitment(desk: Desk, commitment: string): string {
  const kp = Keypair.fromSecret(desk.secret);
  const sig = kp.sign(Buffer.from(commitment, "utf8"));
  return Buffer.from(sig).toString("base64");
}
