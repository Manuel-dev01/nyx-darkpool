# Desk key custody — demo posture vs. production (Freighter)

> **TL;DR for the demo:** each desk is a real **Stellar ed25519 keypair**. It signs every order; the
> engine verifies the signature on-chain-grade (`internal/stellarkey`, `ed25519.Verify`). For the
> demo the secret seed is held in the browser's **`localStorage`** so the page can sign client-side
> with **no backend and no wallet install**. That is a deliberate, scoped trade-off — **production
> signs through the [Freighter](https://www.freighter.app/) wallet extension, where the secret never
> leaves the wallet.** Same signature scheme, same engine verification; only *where the key lives*
> changes.

This is an intentional, documented seam — not an oversight. This note records exactly what the demo
does, why it's safe to demo, what it does and doesn't protect, and the drop-in production path.

---

## 1. What the desk key is

A **desk** is identified by a Stellar account keypair (`G…` public address / `S…` secret seed):

- The **G-address is the order `pubkey`** — orders are attributed to the desk that submitted them.
- Every order's Poseidon **`commitment` is signed** with the desk's secret key (base64 ed25519).
- The engine **verifies** that signature against the `pubkey` before accepting the order
  (`engine/internal/stellarkey` → `ed25519.Verify`), rejecting unsigned/forged orders with `401`
  when `NYX_REQUIRE_ORDER_SIG=true`.

So the keypair is the desk's **identity + order-authentication credential**. It is *not* tied to fund
custody in this build (settlement uses the engine's own Soroban submitter; the desk key only
authenticates intent).

## 2. Demo posture — secret in `localStorage`

`/app/access` lets a desk **generate** a fresh keypair or **import** an existing `S…` seed
(`web/app/_lib/desk.ts`, using `@stellar/stellar-base`). The desk record —
`{ label, publicKey, secret }` — is stored under the `nyx.desk` `localStorage` key so the browser can
re-sign on every order without re-prompting. `AuthGate` redirects `/app/*` to `/app/access` until a
desk exists; `ComposeForm` calls `signCommitment(desk, commitment)` and sends the signature with the
order.

**Why this is fine to demo:**

- **Throwaway testnet identities, no real value.** Generated desks are random keys funded by nothing;
  the live verifier runs on Stellar **testnet** (friendbot-funded). There is nothing to steal.
- **Client-only app, no auth server.** The product frontend is static (`next start`); there is no
  session backend to hold keys. `localStorage` is the simplest way to give the browser a signer.
- **One-click / one-paste for judges.** A reviewer can "Generate key → Authenticate" and immediately
  sign real orders, or import a seed — no extension install, no funding step.

## 3. What this does and does NOT protect

| Property | Demo (`localStorage`) | Production (Freighter) |
|---|---|---|
| Engine authenticates the desk (signature over the commitment) | ✅ yes | ✅ yes (identical) |
| Order attribution to a `G…` identity | ✅ yes | ✅ yes |
| Secret readable by page JavaScript / XSS | ⚠️ **yes** (exposed) | ✅ no — sandboxed in the extension |
| Secret readable by anyone with the device/browser profile | ⚠️ **yes** | ✅ no — extension-encrypted, password-gated |
| Secret survives a `localStorage` clear / leaves on copy | ⚠️ yes | ✅ n/a (never in the page) |
| Phishing-resistant signing prompt | ❌ no | ✅ explicit per-signature approval UI |

The demo posture is **authentication-grade, not custody-grade**: it proves *who* signed an order, but
the signer's secret is exposed to the page. That's acceptable for throwaway testnet keys and a
hackathon demo; it is **not** acceptable for keys that hold value.

## 4. Production path — Freighter (or any wallet)

[Freighter](https://www.freighter.app/) is the standard Stellar browser-wallet extension. The secret
seed lives inside the extension, encrypted and password-gated; the dapp **requests a signature** via
the Freighter API and the user approves it — **the key never enters the page**.

The change is localized to the signing seam — **the engine, the signature scheme, and the order flow
are unchanged**:

- **Identity:** `getAddress()` (Freighter) returns the desk's `G…` → use it as the order `pubkey`
  (replaces `createDesk()/importDesk()` on `/app/access`).
- **Signing:** replace `signCommitment(desk, commitment)` in `web/app/_lib/desk.ts` with a call that
  asks Freighter to sign the commitment bytes (e.g. `signMessage`/the auth-entry API), returning the
  same base64 ed25519 signature shape.
- **No `nyx.desk` secret in `localStorage`** — only the public `G…` (and a connection flag) need
  persist; the gate (`AuthGate`) checks for a connected wallet instead of a stored secret.
- **Engine:** **no change** — `POST /orders` still verifies `ed25519` over the commitment against the
  `pubkey` via `internal/stellarkey`; `NYX_REQUIRE_ORDER_SIG=true` still enforces it.

Because the wire format (signed commitment + `G…` pubkey) is identical, swapping `localStorage` → wallet
is a frontend-only change behind the `desk.ts` signing interface.

## 5. Related seams

- **At-rest order privacy** is separate and already addressed: the order's `price/volume/salt` are
  AES-256-GCM-encrypted in `orders.encrypted_blob` (engine `internal/secret`), with an ephemeral key
  by default. See the project [`../README.md`](../README.md).
- The desk key here authenticates *order intent*; **fund custody / confidential token transfer** is a
  further, deferred extension (the contract exposes a `settle_transfer` SAC seam).
