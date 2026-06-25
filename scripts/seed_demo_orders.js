// ============================================================================
// seed_demo_orders.js — post a crossing ASK/BID pair to the running engine
// ----------------------------------------------------------------------------
// Convenience for demos: seals two orders that cross (ask.price <= bid.price,
// equal volume) with REAL Poseidon commitments (same circomlibjs the circuit
// uses), so the matcher pairs them, generates a Groth16 proof, and — if the
// on-chain bridge is configured — settles via verify_and_settle. Salts are
// random each run, so commitments differ and the pair re-matches every time
// (the on-chain anti-replay only rejects identical commitments).
//
// Usage:
//   node scripts/seed_demo_orders.js
//   ENGINE_URL=http://localhost:8080 node scripts/seed_demo_orders.js
//
// Requires the engine's POST /orders to be reachable (default :8080) and the
// circuits' node_modules (circomlibjs) to be installed.
// ============================================================================
const path = require("path");
const crypto = require("crypto");
const { buildPoseidon } = require(path.join(__dirname, "..", "circuits", "node_modules", "circomlibjs"));

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8080";
const PAIR = process.env.NYX_DEMO_PAIR || "US-TBILL-26/USDC";

// A valid cross: ask price <= bid price, equal volume.
const ASK = { price: 100n, volume: 50n };
const BID = { price: 105n, volume: 50n };

function randomSalt() {
  return BigInt("0x" + crypto.randomBytes(8).toString("hex")).toString();
}

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const commit = (price, volume, salt) =>
    F.toObject(poseidon([price, volume, BigInt(salt)])).toString();

  const mkOrder = (side, o) => {
    const salt = randomSalt();
    const commitment = commit(o.price, o.volume, salt);
    const nullifier = F.toObject(poseidon([BigInt(commitment), BigInt(salt)])).toString();
    return {
      pubkey: "GSEED-DEMO-DESK",
      asset_pair: PAIR,
      side,
      price: o.price.toString(),
      volume: o.volume.toString(),
      salt,
      commitment,
      nullifier,
    };
  };

  const orders = [mkOrder("ask", ASK), mkOrder("bid", BID)];
  for (const body of orders) {
    const res = await fetch(`${ENGINE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`seed: POST ${body.side} failed (${res.status}): ${text}`);
      process.exit(1);
    }
    const { id } = JSON.parse(text);
    console.log(`seeded ${body.side.toUpperCase()} ${PAIR} → order ${id} (commitment ${body.commitment.slice(0, 12)}…)`);
  }
  console.log("OK: crossing pair seeded — the matcher will pair, prove, and settle it.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
