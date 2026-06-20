// ============================================================================
// gen_input.js — produce a witness input for darkpool_match.circom
// ----------------------------------------------------------------------------
// The circuit's public inputs (maker_hash, taker_hash) are Poseidon commitments
// of the private order values. To build a satisfiable input we must compute
// those commitments OFF-CHAIN with the SAME Poseidon as the circuit. We use
// circomlibjs, pinned to a version whose Poseidon constants match the pinned
// circomlib used in-circuit. (If they ever drift, the circuit's
// `maker_hash === hMaker.out` assertion fails loudly during witness
// calculation — a wrong proof can never be silently produced.)
//
// Output: a JSON object on stdout with decimal-string field values. Decimal
// strings are snarkjs-native and are byte-identical to the value stored in the
// Postgres `orders.order_commitment` column, so DB <-> proof public inputs line
// up exactly.
//
// Usage:
//   node gen_input.js              # valid crossing pair (default)
//   node gen_input.js bad-cross    # maker_price > taker_price (price constraint must fail)
//   node gen_input.js bad-volume   # maker_volume != taker_volume (volume constraint must fail)
//
// This same commitment routine is reused by the Go E2E harness and the future
// Phase-5 matcher to compute order commitments.
// ============================================================================

const { buildPoseidon } = require("circomlibjs");

// Sample order books per mode. Values are plain integers (BigInt) well within
// the circuit's 64-bit range.
const MODES = {
  "valid":      { maker: { price: 100n, volume: 50n, salt: 111111n }, taker: { price: 105n, volume: 50n, salt: 222222n } },
  "bad-cross":  { maker: { price: 110n, volume: 50n, salt: 111111n }, taker: { price: 105n, volume: 50n, salt: 222222n } },
  "bad-volume": { maker: { price: 100n, volume: 50n, salt: 111111n }, taker: { price: 105n, volume: 60n, salt: 222222n } },
};

async function main() {
  const mode = process.argv[2] || "valid";
  const book = MODES[mode];
  if (!book) {
    console.error(`gen_input: unknown mode "${mode}" (expected: ${Object.keys(MODES).join(", ")})`);
    process.exit(2);
  }

  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // commitment = Poseidon([price, volume, salt]) as a decimal string.
  const commit = (o) => F.toObject(poseidon([o.price, o.volume, o.salt])).toString();

  const input = {
    // public
    maker_hash: commit(book.maker),
    taker_hash: commit(book.taker),
    // private
    maker_price: book.maker.price.toString(),
    taker_price: book.taker.price.toString(),
    maker_volume: book.maker.volume.toString(),
    taker_volume: book.taker.volume.toString(),
    maker_salt: book.maker.salt.toString(),
    taker_salt: book.taker.salt.toString(),
  };

  process.stdout.write(JSON.stringify(input, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
