// ============================================================================
// e2e_live.mjs — end-to-end API/pipeline test against a running Nyx engine.
// ----------------------------------------------------------------------------
// Exercises the full match → prove → on-chain settle pipeline with REAL signed
// orders (same scheme the frontend uses), plus every negative path, multi-pair
// isolation, the full-fill (equal-volume) rule, and the no-value-leak invariant.
//
// Usage:
//   node scripts/e2e_live.mjs                      # default: live engine
//   ENGINE_URL=http://localhost:8080 node scripts/e2e_live.mjs   # local
//   ENGINE_URL=https://nyx-darkpool.vercel.app/api/engine node scripts/e2e_live.mjs  # via the proxy
//
// Requires web/node_modules (circomlibjs + @stellar/stellar-base) — already
// installed for the frontend. On-chain assertions need the engine running with
// NYX_SOROBAN_CONTRACT_ID set (the live Render engine does); against a plain
// `docker compose` engine (on-chain off) the pipeline test asserts has_proof only.
// ============================================================================
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "..", "web", "node_modules", "x"));
const { buildPoseidon } = require("circomlibjs");
const { Keypair } = require("@stellar/stellar-base");

const ENGINE = (process.env.ENGINE_URL || "https://nyx-engine.onrender.com").replace(/\/+$/, "");
const HORIZON = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
const REAL_PAIR = "US-TBILL-26/USDC";   // a real pair that actually settles
const T = (s) => `ZZ-E2E-${s}/USDC`;     // throwaway test pairs (won't clash with demo pairs)

let poseidon, F;
const rs = () => BigInt("0x" + crypto.randomBytes(8).toString("hex")).toString();
const commit = (p, v, s) => F.toObject(poseidon([BigInt(p), BigInt(v), BigInt(s)])).toString();

function sealed(price, volume) {
  const salt = rs();
  const c = commit(price, volume, salt);
  const nullifier = F.toObject(poseidon([BigInt(c), BigInt(salt)])).toString();
  return { price: String(price), volume: String(volume), salt, commitment: c, nullifier };
}
function orderBody(desk, pair, side, s) {
  const sig = desk.sign(Buffer.from(s.commitment, "utf8")).toString("base64");
  return { pubkey: desk.publicKey(), asset_pair: pair, side, price: s.price, volume: s.volume,
    salt: s.salt, commitment: s.commitment, nullifier: s.nullifier, signature: sig };
}
async function post(body) {
  const res = await fetch(`${ENGINE}/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  let json = null; try { json = JSON.parse(await res.text()); } catch {}
  return { status: res.status, json };
}
async function getJSON(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  let json = null; try { json = JSON.parse(await res.text()); } catch {}
  return { status: res.status, json };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findMatchId(orderId) {
  const { json } = await getJSON(`${ENGINE}/orders?limit=200`);
  const o = (json?.orders || []).find((x) => x.id === orderId);
  return o?.match_id || null;
}

// --- test registry ----------------------------------------------------------
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log(`  PASS  ${name}`); }
  catch (e) { results.push({ name, ok: false, err: e.message }); console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function main() {
  poseidon = await buildPoseidon(); F = poseidon.F;
  console.log(`\n== Nyx E2E against ${ENGINE} ==\n`);

  // 0. health (also wakes a sleeping free-tier engine)
  await test("healthz returns ok (waking engine if asleep)", async () => {
    let last;
    for (let i = 0; i < 20; i++) {
      last = await getJSON(`${ENGINE}/healthz`);
      if (last.status === 200 && last.json?.status === "ok") return;
      await sleep(5000);
    }
    throw new Error(`healthz never ok (last: ${last.status} ${JSON.stringify(last.json)})`);
  });

  // 1. negatives
  const desk = Keypair.random();
  await test("unsigned POST /orders → 401", async () => {
    const s = sealed(9984, 5_000_000);
    const body = { pubkey: desk.publicKey(), asset_pair: REAL_PAIR, side: "bid", price: s.price,
      volume: s.volume, salt: s.salt, commitment: s.commitment, nullifier: s.nullifier }; // no signature
    const r = await post(body);
    assert(r.status === 401, `expected 401, got ${r.status} ${JSON.stringify(r.json)}`);
  });
  await test("bad side → 400", async () => {
    const s = sealed(1, 1);
    const r = await post({ ...orderBody(desk, REAL_PAIR, "buy", s) });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  await test("missing pubkey/pair → 400", async () => {
    const r = await post({});
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  await test("duplicate nullifier → 409", async () => {
    const s = sealed(7777, 12345);
    const body = orderBody(desk, T("DUP"), "bid", s);
    const first = await post(body);
    assert(first.status === 201, `first post expected 201, got ${first.status} ${JSON.stringify(first.json)}`);
    const second = await post(body); // identical commitment+nullifier
    assert(second.status === 409, `replay expected 409, got ${second.status} ${JSON.stringify(second.json)}`);
  });

  // 2. GET /orders never leaks price/volume/salt
  await test("GET /orders leaks no private values", async () => {
    const { json } = await getJSON(`${ENGINE}/orders?limit=5`);
    for (const o of json?.orders || []) {
      for (const k of ["price", "volume", "salt"]) {
        assert(!(k in o), `order ${o.id} leaked field "${k}"`);
      }
    }
  });

  // 3. multi-pair isolation: bid on A + ask on B never cross (stay open)
  await test("different pairs never cross (isolation)", async () => {
    const v = 4242, px = 5000;
    const a = await post(orderBody(desk, T("ISO-A"), "bid", sealed(px, v)));
    const b = await post(orderBody(desk, T("ISO-B"), "ask", sealed(px, v)));
    assert(a.status === 201 && b.status === 201, `posts failed: ${a.status}/${b.status}`);
    await sleep(6000);
    for (const id of [a.json.id, b.json.id]) {
      const mid = await findMatchId(id);
      assert(!mid, `order ${id} matched across pairs (match ${mid})`);
    }
  });

  // 4. full-fill rule: same pair, UNEQUAL volume → never match
  await test("unequal volume never matches (full-fill rule)", async () => {
    const pair = T("VOL");
    const bid = await post(orderBody(desk, pair, "bid", sealed(9000, 1000)));
    const ask = await post(orderBody(desk, pair, "ask", sealed(8000, 999))); // crosses on price, vol differs
    assert(bid.status === 201 && ask.status === 201, `posts failed: ${bid.status}/${ask.status}`);
    await sleep(6000);
    for (const id of [bid.json.id, ask.json.id]) {
      const mid = await findMatchId(id);
      assert(!mid, `unequal-volume order ${id} matched (match ${mid})`);
    }
  });

  // 5. full pipeline: signed crossing pair (equal vol) → match → prove → (on-chain) settle
  await test("full pipeline: match → prove → settle", async () => {
    const px = 9984, vol = 5_000_000;
    const bid = await post(orderBody(desk, REAL_PAIR, "bid", sealed(px, vol)));
    const ask = await post(orderBody(desk, REAL_PAIR, "ask", sealed(px, vol)));
    assert(bid.status === 201 && ask.status === 201, `posts failed: ${bid.status}/${ask.status}`);

    // wait for a match id
    let mid = null;
    for (let i = 0; i < 20 && !mid; i++) { mid = await findMatchId(bid.json.id); if (!mid) await sleep(3000); }
    assert(mid, "no match formed within ~60s");

    // wait for proof, then terminal on-chain state
    let m, onchainEnabled = false;
    for (let i = 0; i < 40; i++) {
      ({ json: m } = await getJSON(`${ENGINE}/matches/${mid}`));
      if (m?.onchain_status && m.onchain_status !== "pending") onchainEnabled = true;
      if (m?.has_proof && (m.onchain_status === "confirmed" || m.onchain_status === "failed")) break;
      if (m?.has_proof && !onchainEnabled && i > 4) break; // on-chain disabled: proof is terminal
      await sleep(3000);
    }
    assert(m?.has_proof === true, `proof never generated (match ${JSON.stringify(m)})`);

    if (onchainEnabled) {
      assert(m.onchain_status === "confirmed", `on-chain not confirmed: ${m.onchain_status}`);
      assert(m.settlement_tx, "confirmed but no settlement_tx");
      // verify the tx really succeeded on testnet
      const { json: tx } = await getJSON(`${HORIZON}/transactions/${m.settlement_tx}`);
      assert(tx?.successful === true, `Horizon says tx not successful: ${JSON.stringify(tx?.successful)}`);
      console.log(`        settled tx ${m.settlement_tx} (ledger ${tx.ledger}) ✓`);
    } else {
      console.log(`        on-chain disabled on this engine — proof stored, settle skipped (by design)`);
    }
  });

  // --- summary ---
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n== ${passed}/${results.length} passed ==\n`);
  process.exit(passed === results.length ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
