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

> **Why not `docker compose up`?** That's the fast, fully-containerized stack — but the engine image
> deliberately ships **no `stellar` CLI**, so on-chain settlement is off there and the pipeline stops
> after the proof is stored (`onchain_status: pending` by design). For the *live* demo you want the
> host engine (`make demo`) so the chain leg actually fires. Both prove the proof in-process; only
> `make demo` settles on testnet.

---

## Act 1 — "Nothing is revealed" (the desk + the seal)

1. **Landing (`/`).** One line: *public order books leak institutional intent — large RWA orders get
   front-run. Nyx matches privately and only a proof touches the chain.* Click **Request desk access**.
2. **Desk access (`/app/access`).** Click **Generate** — this mints a **real Stellar keypair** in the
   browser. The **G-address becomes the desk's identity** and signs every order. (Mention: in
   production this is a Freighter wallet — the secret never touches the page. See
   [`key-custody.md`](key-custody.md).)
3. **Compose (`/app/compose`).** Pick a **pair** from the dropdown (e.g. `US-TBILL-26 / USDC`), set
   **BID · BUY**, price `99.84`, size `5,000,000`. Point at the **SEAL PREVIEW**: as you type, the
   browser computes a **real Poseidon commitment** (`circomlibjs`, the exact constants the circuit
   uses). Read the caption aloud: *"price & size never leave this device — the network only ever sees
   this hash."* **Do not broadcast yet** if you're doing Act 3 manually; broadcast now for Act 2.

---

## Act 2 — Solo settle, end-to-end (Demo-Mode ON)

This is the cleanest single-flow proof that the whole pipeline is real. Keep **Demo-Mode ON** (the
sidebar toggle "Auto-fill counterparty · demo", default on).

1. On Compose, click **Seal & broadcast →**. You land on **Pool (`/app/pool`)** — your sealed order
   sits in the shielded lattice. ~2.5 s later, Demo-Mode posts **one** crossing, **signed**
   counter-order (same pair/price/size, opposite side, fresh salt) so a solo order can settle.
2. Go to **Proofs (`/app/proofs`)** and narrate the pipeline as it advances (poll every ~2.5 s):
   - **Match located** → DONE (the matcher paired your BID with the crossing ASK).
   - **ZK proof generated** → DONE (`has_proof:true` — snarkjs built the Groth16 witness + proof in
     the engine; *a wrong commitment can't produce a proof — witness calc fails*).
   - **Verifying on-chain** → ACTIVE for ~5–15 s, then DONE (the engine invoked `verify_and_settle`
     on **testnet**; the contract re-ran the BN254 pairing check natively).
   - **Atomic settlement** → DONE.
3. **Settled (`/app/settled`).** Heading flips to **"Settled atomically."** Click **View on Stellar
   Explorer →** — a **real testnet transaction** opens on stellar.expert. This is the money shot:
   *the operator can't forge fills; the chain re-verified the match.* Click **Download receipt** to
   save the JSON settlement receipt.

> Talking point while "Verifying on-chain" spins: *"That delay is real — it's the testnet ledger
> closing. We're not animating a spinner; we're waiting for a block."*

---

## Act 3 — Two desks, two tabs (Demo-Mode OFF, manual cross)

Shows that two **independent** desks settle the **same** match without either learning the other's
private values — the real institutional story.

1. In **both** tabs, open the sidebar and turn **Demo-Mode OFF**.
2. **Tab A (Desk 1):** `/app/access` → Generate (Desk 1's keypair) → Compose → pick
   **`US-TBILL-26 / USDC`**, **BID** `99.84` × `5,000,000` → Seal & broadcast. It rests in the pool
   (no auto-counter now).
3. **Tab B (Desk 2):** `/app/access` → Generate (a **different** keypair) → Compose → pick the
   **same pair** `US-TBILL-26 / USDC`, **ASK** `99.84` × `5,000,000` → Seal & broadcast.
   > The matcher only crosses **same-pair** orders — both desks must select the same pair. (Show this:
   > if Tab B picks `EU-BUND-30 / USDC` instead, nothing crosses — different markets don't match.)
4. The engine pairs the two **real** orders (one shared match). Open **Proofs** in *both* tabs — they
   converge on the **same** match id and both animate to **Settled** against the **same** testnet tx.
5. Emphasize: Desk 1 never saw Desk 2's order values and vice-versa; the API never returns price/size
   (they stay sealed). Two counterparties, one verifiable fill, zero information leakage.

> **Race fallback (optional aside):** with Demo-Mode left ON, the auto-counter cancels itself the
> moment a real opposing order (a second tab) appears — so a live counterparty always wins over the
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
