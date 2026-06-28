# Nyx Darkpool — Test / QA Checklist

A hands-on checklist for **finding bugs** on the live app. Walk every screen, tick each box, and log
anything that doesn't match the **Expected** column in the bug table at the bottom.

This is the **tester's** sweep — distinct from [`demo-script.md`](demo-script.md), which is the
**presenter's** happy-path narrative. Use this to break things; use that to show things.

- **Live web:** <https://nyx-darkpool.vercel.app>
- **Live engine API:** <https://nyx-engine.onrender.com> (the web reaches it via `/api/engine/*`)

---

## 0. Pre-flight

- [ ] **Wake the engine** (Render free tier sleeps after ~15 min idle):
      `curl -s https://nyx-engine.onrender.com/healthz` → `{"db":"up","status":"ok"}`. The **first**
      call after idle can take ~1 min (cold start) — that's expected, not a bug.
- [ ] Open **two** browser profiles / an incognito window too — needed for the multi-desk tests (§8).
- [ ] Have DevTools **Console** + **Network** open to catch errors/failed requests.

---

## 1. Landing (`/`)

- [ ] Page loads in the dark theme; hero + sections render; **no console errors**.
- [ ] Nav **Protocol** / **Proofs** smooth-scroll to the right sections.
- [ ] Nav **Docs** / hero **Read the spec** open the GitHub repo in a new tab.
- [ ] **Enter the pool** / **Request desk access** route to `/app/access`.
- [ ] *Known placeholder:* the **Talk to us / contact** link is a `mailto:` to a placeholder address
      (set in `app/page.tsx`) — fine to flag, not a functional bug.
- [ ] Resize to mobile width (≤ 768px): layout reflows, no horizontal scroll.

## 2. Desk access (`/app/access`)

- [ ] First visit (no desk): **Generate** mode shows a fresh G-address + S-seed.
- [ ] **Regenerate** produces a new keypair instantly.
- [ ] **Authenticate with new key →** routes to `/app`; returning to `/app/access` now offers
      **Continue as G… →** (desk persisted in `localStorage` → `nyx.desk`).
- [ ] **Import** tab: paste a valid Stellar `S…` seed → authenticates. Paste junk (e.g. `hello`) →
      inline error “Not a valid Stellar secret key (S…)”.
- [ ] **Use a different key** clears the desk; **Sign out** (sidebar, later) returns here.

## 3. Desk (`/app`)

- [ ] Loads only when authenticated; visiting `/app/*` with no desk redirects to `/app/access`
      (brief “AUTHENTICATING…”).
- [ ] Stat cells (Open / Matched / Settled / Total) + **Activity** feed render and **poll ~every 3 s**
      (post an order elsewhere → counts update without a manual refresh).
- [ ] Orders table shows PAIR / SIDE (BID green, ASK red) / COMMITMENT / STATUS — **no price or size**.
- [ ] If the engine is asleep/unreachable, the table shows an `engine unreachable: …` state (then
      recovers after the cold start).

## 4. Compose (`/app/compose`)

- [ ] **Pair** `<select>` lists 4 pairs: `US-TBILL-26`, `US-TBILL-27`, `EU-BUND-30`, `GOLD-RWA` (all
      `/USDC`). Changing it recomputes the seal preview.
- [ ] **BID/ASK** toggle flips colour; **TIF** (GTC/IOC/1H) toggles visually (*visual only — not yet
      enforced by the engine*; flag only if it errors).
- [ ] **Seal preview** shows a live Poseidon **commitment** that changes as you edit price/size.
- [ ] **Validation rejects** (preview shows a red error, broadcast disabled):
  - [ ] price `99.123` → “price supports at most 2 decimals”.
  - [ ] price `abc` → “invalid price”.
  - [ ] size `5.5` → “invalid size” (integers only).
  - [ ] *Accepted:* price `99.84` → scaled to `9984` (×100); size `5,000,000` / `5 000 000` →
        `5000000` (separators stripped).
- [ ] **Seal & broadcast →** with valid input: button shows “Broadcasting…”, then routes to
      `/app/pool?order=<id>`. The order is **signed** automatically (the live engine requires it).

## 5. Pool (`/app/pool`)

- [ ] Your sealed order appears in the lattice + the right-hand detail (price/size shown as “•••• ·
      sealed” — never revealed).
- [ ] Header shows **SEARCHING FOR MATCH** until a counter appears.
- [ ] **Demo-Mode ON** (default; sidebar toggle “Auto-fill counterparty · demo”): after **~2.5 s** an
      auto counter-order posts and the status flips to **MATCHED**; a “View proof →” link appears.
- [ ] **Race fallback:** with Demo-Mode ON, if a *real* opposing order (a 2nd tab) lands first, the
      auto-counter does **not** post (no duplicate).

## 6. Proofs (`/app/proofs`)

Watch the 4-stage pipeline (polls ~every 2.5 s). On the **live** site all four reach **DONE**:

- [ ] **Match located** → DONE once paired.
- [ ] **ZK proof generated** → ACTIVE then DONE (`has_proof:true`; ~3–10 s, first one after a cold
      start can be ~10–20 s).
- [ ] **Verifying on-chain** → ACTIVE then DONE (`onchain_status:confirmed`; ~5–15 s — a real testnet
      ledger closing).
- [ ] **Atomic settlement** → DONE. Right panel shows the **settlement tx** + `bn254_pairing` host fn.
- [ ] *(A FAILED stage 3/4 shows red — would indicate a real on-chain failure; log it.)*

## 7. Settled (`/app/settled`)

- [ ] Heading flips to **“Settled atomically.”**; STATUS = CONFIRMED.
- [ ] **View on Stellar Explorer →** opens a **real** `stellar.expert/explorer/testnet/tx/…` page
      (status SUCCESS).
- [ ] **Download receipt** saves `nyx-receipt-<id>.json` containing the match + tx + explorer link and
      **omitting price/size** (note: “Price and size are sealed off-chain”).

## 8. Multi-desk / multi-tab (the real institutional flow)

- [ ] In **both** windows, toggle **Demo-Mode OFF** (sidebar).
- [ ] **Window A** (Desk 1): generate a key → compose **BID** `US-TBILL-26/USDC` `99.84 × 5,000,000` →
      broadcast (it rests OPEN).
- [ ] **Window B** (Desk 2, different key): compose a crossing **ASK** on the **same pair** `99.84 ×
      5,000,000` → broadcast.
- [ ] Both windows converge to the **same** match and animate to **Settled** against the **same** tx.
- [ ] **Cross-pair isolation:** if Window B picks a *different* pair (e.g. `GOLD-RWA/USDC`), nothing
      crosses — both stay OPEN.

## 9. API / negative tests (the public engine)

Run against `https://nyx-engine.onrender.com` (the proxy path is `…vercel.app/api/engine/*`). Verified
expected values:

- [ ] `GET /healthz` → `200 {"db":"up","status":"ok"}`.
- [ ] Unsigned `POST /orders` → **401** `{"error":"order signature required"}` (sig enforced on the
      live engine).
- [ ] `POST /orders` with `side:"buy"` → **400** `side must be "bid" or "ask"`.
- [ ] `POST /orders` with `{}` → **400** `pubkey and asset_pair are required`.
- [ ] Re-posting an order with a reused `nullifier` → **409** `nullifier already used`.
- [ ] `GET /orders` returns only `id,pubkey,asset_pair,side,commitment,status,match_id,created_at` —
      **never** `price`/`volume`/`salt`.

```bash
# unsigned -> 401
curl -s -X POST https://nyx-engine.onrender.com/orders -H 'Content-Type: application/json' \
  -d '{"pubkey":"G...","asset_pair":"US-TBILL-26/USDC","side":"bid","price":"9984","volume":"5000000","salt":"1","commitment":"2","nullifier":"3"}'
```

---

## Known gotchas (expected behaviour — don't log these as bugs)

| Behaviour | Why |
|-----------|-----|
| First request after idle takes ~1 min | Render free tier cold start |
| Proof ~3–10 s, on-chain ~5–15 s | snarkjs witness + a real testnet ledger close |
| Demo-Mode ON auto-fills a counterparty | demo convenience; turn OFF for a true two-desk cross |
| TIF buttons (GTC/IOC/1H) don't change matching | visual only; not yet enforced |
| `/app/positions` is a placeholder | "Coming soon" by design |
| Landing contact link goes nowhere | placeholder `mailto:` address |
| Desk secret lives in `localStorage` | documented demo seam (prod = Freighter) — see [`key-custody.md`](key-custody.md) |
| `docker compose up` never reaches "Settled" | on-chain is off there by design — use the live site or `make demo` |

## Bug log

| # | Screen / endpoint | Steps to reproduce | Expected | Actual | Severity |
|---|-------------------|--------------------|----------|--------|----------|
| 1 |                   |                    |          |        |          |
| 2 |                   |                    |          |        |          |
| 3 |                   |                    |          |        |          |

> Severity: **P0** broken core flow (can't settle) · **P1** wrong/missing data or error state ·
> **P2** cosmetic/polish. File P0/P1 findings with the screen + the Network request that failed.
