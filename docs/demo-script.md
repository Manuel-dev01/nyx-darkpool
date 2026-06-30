# Nyx Darkpool — Live Demo Script

A presenter runbook for demoing Nyx end-to-end: two desks place **shielded** RWA orders, the
off-chain engine **matches** them, generates a **Groth16 proof** that they cross at a valid
price/volume *without revealing either*, and a Soroban contract **re-verifies that proof on real
Stellar testnet** and settles — with a browsable transaction. Neither desk ever learns the other's
price or size.

> **The one-liner:** *"Two institutions cross a block trade. The price and size never leave their
> browsers. The chain sees only a hash and a proof — and still guarantees the fill is real."*

---

## 0. Pre-flight (do this ~5 minutes before)

You need **two terminals** + a browser with **two tabs** (ideally two profiles/incognito so each tab
is its own desk).

**Terminal 1 — the demo engine (REAL on-chain testnet settlement):**
```bash
make demo            # or: bash scripts/demo_testnet.sh
```
This brings up Postgres (docker compose), confirms the deployed testnet verifier is reachable
(redeploys + re-funds automatically if testnet has reset), and runs the engine on the host with
on-chain settlement **on**. Wait for the log line:
```
matcher started proving:true onchain:true
```
That `onchain:true` is the whole point — it's what makes settlement real instead of a stored proof.

**Terminal 2 — the web app:**
```bash
make demo-web        # or: cd web && npm run dev
```
Open **http://localhost:3000**.

**Sanity checks before you present:**
- `curl -s localhost:8080/healthz` → `{"status":"ok","db":"up"}`
- The engine banner printed an `explorer:` URL — open it once to confirm the contract page loads on
  stellar.expert.
- Do **one throwaway dry run** of Act 2 end-to-end so the first real proof's snarkjs warm-up
  (~3–5 s) is already paid and the testnet identity is funded.

**If testnet has reset** (the contract page 404s): `make demo` handles it — it calls
`scripts/deploy_contract.sh` to redeploy and friendbot-fund the identity, then prints the new CID.
Just re-run `make demo` and update the explorer link you show.

> **Why not `docker compose up`?** That's the fast, fully-containerized stack — but it leaves
> `NYX_SOROBAN_CONTRACT_ID` **unset**, so on-chain settlement is off there and the pipeline stops after
> the proof is stored (`onchain_status: pending` by design). For the *live* demo you want the chain leg
> to actually fire: use `make demo` (host engine with the contract id set), or just open the **live
> deployment** (<https://nyx-darkpool.vercel.app>), which settles on testnet out of the box. Both prove
> the proof in-process; on-chain settles wherever `NYX_SOROBAN_CONTRACT_ID` is set.

---

## Act 1 — "Nothing is revealed" (the desk + the seal)

| Shot | Screen | Action | What's on screen / say |
|------|--------|--------|------------------------|
| **1.1** | `/` (landing) | Click **Request desk access** | Say: *"public order books leak institutional intent; large RWA orders get front-run. Nyx matches privately and only a proof touches the chain."* |
| **1.2** | `/app/access` | Click **Generate**, then **Authenticate with new key →** | Mints a **real Stellar keypair** in the browser; the **G-address becomes the desk's identity** and signs every order. Say: *"in production this is a Freighter wallet, the secret never touches the page"* (see [`key-custody.md`](key-custody.md)). |
| **1.3** | `/app/compose` | Pick pair `US-TBILL-26 / USDC`, **BID · BUY**, price `99.84`, size `5,000,000` | As you type, the **SEAL PREVIEW** computes a **real Poseidon commitment** (`circomlibjs`, the exact constants the circuit uses). Read the caption: *"price & size never leave this device; the network only ever sees this hash."* |

> **Branch here.** For **Act 2** (solo settle) continue straight to **Seal & broadcast** (shot 2.1).
> For **Act 3** (two desks, manual cross) **do not broadcast yet**; set up the second window first.

---

## Act 2 — Solo settle, end-to-end (Demo-Mode ON)

The cleanest single-flow proof that the whole pipeline is real. Keep **Demo-Mode ON** (sidebar toggle
"Auto-fill counterparty · demo", default on). One window is enough. Shoot it shot by shot:

| Shot | Screen | Action | What's on screen / say |
|------|--------|--------|------------------------|
| **2.1** | `/app/compose` | **Seal & broadcast →** (continuing from Act 1) | Routes to **Pool**; your sealed order sits in the shielded lattice; header reads **SEARCHING FOR MATCH**. |
| **2.2** | `/app/pool` | wait ~2.5 s | Demo-Mode posts **one** crossing, signed counter-order (same pair/price/size, opposite side, fresh salt). Header flips to **MATCH FOUND**; a **View proof →** link appears. |
| **2.3** | `/app/proofs` | click **View proof →** | **Match located → DONE.** Say: *"the matcher paired your BID with the crossing ASK."* |
| **2.4** | `/app/proofs` | watch (~3-10 s) | **ZK proof generated → DONE** (`has_proof:true`). Say: *"snarkjs built the Groth16 proof in-engine; a wrong commitment can't even produce a witness."* |
| **2.5** | `/app/proofs` | watch (~5-15 s) | **Verifying on-chain → DONE.** Say: *"that wait is a real testnet ledger closing, not a spinner."* |
| **2.6** | `/app/proofs` | (no click) | **Atomic settlement → DONE.** Right panel shows the **settlement tx** + `bn254_pairing` host fn. |
| **2.7** | `/app/settled` | open **Settled** (sidebar) | Heading flips to **"Settled atomically."**; STATUS = CONFIRMED. |
| **2.8** | `/app/settled` | click **View on Stellar Explorer →** | A **real testnet transaction** opens on stellar.expert (status SUCCESS). **The money shot:** *the operator can't forge fills; the chain re-verified the match.* |
| **2.9** | `/app/settled` | click **Download receipt** | Saves `nyx-receipt-*.json` (match + tx + explorer link; **price and size omitted**). |

---

## Act 3 — Two desks, two tabs (Demo-Mode OFF, manual cross)

The institutional story: two **independent** desks settle the **same** match, and **neither learns the
other's price or size**. Demo-Mode OFF means there's no auto-counter, so the cross is a genuine second
party. Shoot it strictly in order: **Desk 1 rests first, then Desk 2 crosses it.**

> ### Critical setup: two SEPARATE storage contexts (do this before shot 3.1)
> Use **Window A = a normal browser window** and **Window B = an Incognito / Private window** (or two
> different browser profiles). **NOT two tabs of the same window:** the desk key lives in
> `localStorage`, which every tab of one profile shares, so two same-profile tabs are the *same* desk
> (generating a key in one silently overwrites the other). Separate profiles = separate desks. Point
> **both** windows at **http://localhost:3000**. (For recording: put them side by side so one shot
> can show both flipping to settled together.)

**Shot list:**

| Shot | Window | Action | What's on screen / say |
|------|--------|--------|------------------------|
| **3.1** | **A** | `/app/access` → **Generate** → **Authenticate with new key →** | Desk 1's **G-address** appears in the sidebar. Say: *"Desk 1's identity, a real Stellar key."* |
| **3.2** | **A** | Sidebar → click the **"Auto-fill counterparty · demo"** toggle **OFF** | The toggle goes dark. Say: *"No bot now, a real counterparty has to show up."* |
| **3.3** | **A** | **Compose** → pair **`US-TBILL-26 / USDC`**, **BID · BUY**, price `99.84`, size `5,000,000` | SEAL PREVIEW shows Desk 1's live **Poseidon commitment**. |
| **3.4** | **A** | **Seal & broadcast →** | Lands on **Pool**; the order **rests**; header stays **SEARCHING FOR MATCH** (no auto-fill fires). Say: *"resting, unmatched."* |
| **3.5** | **B** | `/app/access` → **Generate** → **Authenticate with new key →** | A **different** G-address. Say: *"Desk 2, a separate key in a separate browser."* |
| **3.6** | **B** | Sidebar → toggle **Demo-Mode OFF** | Toggle dark (same as 3.2). |
| **3.7** | **B** | **Compose** → **same** pair **`US-TBILL-26 / USDC`**, **ASK · SELL**, price `99.84`, size `5,000,000` | A **different** commitment hash than Desk 1, even though the values match (fresh salt). Say: *"same trade, different seal; neither desk can see the other's numbers."* |
| **3.8** | **B** | **Seal & broadcast →** | Lands on Pool. Within ~3 s **both** windows flip: header **MATCH FOUND**, order status **MATCHED**, a **View proof →** link appears in each. |
| **3.9** | **A + B** | each window → **Proofs** (sidebar) | Both show the **same match id** in the header, and both pipelines run Match located → ZK proof → Verifying on-chain → Settled. |
| **3.10** | **A + B** | each → **Settled** → **View on Stellar Explorer →** | Both open the **same** testnet transaction (status SUCCESS). Say: *"one fill, one transaction, two counterparties."* |
| **3.11** | (say) | — | *"Desk 1 never saw Desk 2's price or size, and vice-versa. `GET /orders` only ever returns commitments. Two parties, one verifiable fill, zero information leakage."* |

**Two rules worth a deliberate negative shot (each proves the engine isn't faking it):**
- **Full-fill model, sizes must match exactly.** Both used `5,000,000`. *Negative shot:* in **B** set
  size `5,000,001` and broadcast: nothing crosses (both rest OPEN). Reset to `5,000,000` to cross.
- **Same pair only.** *Negative shot:* in **B** pick **`EU-BUND-30 / USDC`** instead and broadcast:
  nothing crosses. Say: *"different markets never match."* Switch back to `US-TBILL-26 / USDC` to cross.

> **Race fallback (optional aside):** with Demo-Mode left **ON**, the auto-counter stands down the
> moment a real opposing order (a second window) appears, so a live counterparty always wins over the
> demo bot. Two desks can never double-match: the engine pairs under SERIALIZABLE isolation with
> UNIQUE maker/taker constraints as the backstop.

---

## Act 4 — "How do I know it's real?"

The skeptic's act. Everything you've shown is backed by artifacts you can open live:

- **The contract** — open the engine banner's `explorer:` link: the deployed `nyx-verifier` on
  testnet, with `verify_and_settle` in its interface.
- **The transaction** — the settlement tx from Act 2/3 on stellar.expert (status SUCCESS, real
  ledger). A known-good reference tx also lives in [`../STATUS.md`](../STATUS.md).
- **Anti-replay** — the contract records a `Settled` marker over the public inputs; re-submitting the
  same match is rejected (`AlreadySettled`). The DB enforces it too (UNIQUE maker/taker, `nullifier`).
- **Privacy at rest** — the order blob is **AES-256-GCM encrypted** in Postgres (ephemeral key by
  default — no secret on disk). A DB dump leaks nothing; the chain sees only the commitment + proof.
- **Authenticity** — every order carries an **ed25519 signature** by the desk's Stellar key, verified
  by the engine.

### What's real vs. what's a demo seam (be honest — it builds trust)

| Component | In this demo |
|-----------|--------------|
| Poseidon commitment, Groth16 proof, witness | **Real** — `circomlibjs` in-browser + snarkjs in-engine, same constants as the circuit |
| On-chain verification + settlement | **Real** — Soroban `verify_and_settle` on public Stellar testnet (protocol 27, BN254 host fns) |
| Order signatures (ed25519 over the commitment) | **Real** — engine-verified |
| At-rest blob encryption (AES-256-GCM) | **Real** |
| Demo-Mode auto-counterparty | **A demo convenience** — auto-fills a crossing order so a solo desk can settle; turn OFF for a true two-desk cross |
| Desk secret in `localStorage` | **A documented seam** — production signs via the Freighter wallet (secret never in the page); same signature scheme, only the signing seam changes |
| Asset transfer of the RWA/USDC legs | **Settlement is proven & recorded on-chain**; wiring a Stellar Asset Contract token movement behind `settle_transfer` is the documented next step |

---

## Quick reference

| Thing | Value |
|-------|-------|
| Web | http://localhost:3000 |
| Engine API | http://localhost:8080 (`/healthz`, `/orders`, `/matches/{id}`) |
| Start engine (on-chain) | `make demo` · `bash scripts/demo_testnet.sh` |
| Start web | `make demo-web` · `cd web && npm run dev` |
| Force fresh testnet deploy | `NYX_REDEPLOY=1 make demo` |
| Demo-Mode toggle | sidebar — "Auto-fill counterparty · demo" |
| localStorage keys | `nyx.desk`, `nyx.activeOrder`, `nyx.demoMode` |
| Pairs | `US-TBILL-26/USDC`, `US-TBILL-27/USDC`, `EU-BUND-30/USDC`, `GOLD-RWA/USDC` |

**Flow:** `/` → Request desk access → `/app/access` (Generate) → `/app` (Desk) → **+ New** →
`/app/compose` (pick pair, Seal & broadcast) → `/app/pool` → `/app/proofs` → `/app/settled`.

### Reset between runs
- New desk: sidebar → sign out (or clear `localStorage`) → `/app/access` → Generate.
- Clear the book: `make down-v` (wipes the DB volume), then `make demo` again. Each new order uses a
  fresh salt, so commitments never collide and on-chain anti-replay won't trip across runs.
