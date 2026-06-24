// ============================================================================
// proof_to_bytes.js — convert snarkjs Groth16 (BN254) artifacts to raw bytes
// ----------------------------------------------------------------------------
// snarkjs emits field elements as DECIMAL strings. The Soroban BN254 host
// functions want fixed 32-byte field elements. This is the SINGLE SOURCE OF
// TRUTH for that conversion, consumed by both:
//   - the Rust contract tests (raw .bin fixtures + embedded verifying key), and
//   - the Go on-chain bridge (hex strings for `stellar contract invoke`).
//
// Encoding rules:
//   - field element -> 32 bytes, BIG-ENDIAN (FE_ENDIAN=big|little, default big)
//   - G1 point      -> X(32) || Y(32)                              = 64 bytes
//   - G2 point      -> Fp2 X || Fp2 Y, each Fp2 = two Fp limbs      = 128 bytes
//                      snarkjs gives [[x_c0,x_c1],[y_c0,y_c1]]; the c0/c1 limb
//                      ORDER is the footgun (G2_ORDERING=c1c0|c0c1, default c1c0
//                      per the EIP-197 / arkworks convention). The Rust
//                      happy-path test is the oracle: if a valid proof fails to
//                      verify on-chain, flip G2_ORDERING (and/or FE_ENDIAN).
//
// Modes:
//   node proof_to_bytes.js fixtures
//       reads circuits/{proof,public,verification_key}.json, writes
//       contracts/nyx-verifier/test_vectors/*.bin, and prints the embedded
//       verifying-key Rust `const [u8; N]` arrays to stdout (for one-time paste
//       into contracts/nyx-verifier/src/vk.rs).
//   node proof_to_bytes.js hex <proof.json> <public.json>
//       prints {proof_a,proof_b,proof_c,public:[...]} as 0x-hex JSON for Go.
// ============================================================================

const fs = require("fs");
const path = require("path");

const G2_ORDERING = process.env.G2_ORDERING || "c1c0"; // c1c0 | c0c1
const FE_ENDIAN = process.env.FE_ENDIAN || "big"; // big | little

const ROOT = path.resolve(__dirname, "..");
const CIRCUITS = path.join(ROOT, "circuits");
const VECTORS = path.join(ROOT, "contracts", "nyx-verifier", "test_vectors");

// ---- primitives -----------------------------------------------------------

// Decimal field element -> 32-byte buffer (big-endian by default).
function fe(dec) {
  let n = BigInt(dec);
  if (n < 0n) throw new Error(`negative field element: ${dec}`);
  const b = Buffer.alloc(32);
  for (let i = 31; i >= 0; i--) {
    b[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  if (n !== 0n) throw new Error(`field element exceeds 32 bytes: ${dec}`);
  if (FE_ENDIAN === "little") b.reverse();
  return b;
}

// G1 affine [x, y, "1"] -> 64 bytes (X || Y).
function g1(p) {
  return Buffer.concat([fe(p[0]), fe(p[1])]);
}

// G2 affine [[x0,x1],[y0,y1],[1,0]] -> 128 bytes (Fp2 X || Fp2 Y).
function g2(p) {
  const [x, y] = [p[0], p[1]];
  const fp2 = (c) => (G2_ORDERING === "c1c0"
    ? Buffer.concat([fe(c[1]), fe(c[0])])   // c1 first
    : Buffer.concat([fe(c[0]), fe(c[1])])); // c0 first
  return Buffer.concat([fp2(x), fp2(y)]);
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// ---- modes ----------------------------------------------------------------

function fixtures() {
  const proof = readJSON(path.join(CIRCUITS, "proof.json"));
  const pub = readJSON(path.join(CIRCUITS, "public.json"));
  const vk = readJSON(path.join(CIRCUITS, "verification_key.json"));

  const proofA = g1(proof.pi_a);
  const proofB = g2(proof.pi_b);
  const proofC = g1(proof.pi_c);
  if (proofA.length !== 64) throw new Error("proof_a != 64 bytes");
  if (proofB.length !== 128) throw new Error("proof_b != 128 bytes");
  if (proofC.length !== 64) throw new Error("proof_c != 64 bytes");

  fs.mkdirSync(VECTORS, { recursive: true });
  // Proof + public input fixtures (consumed by src/test.rs via include_bytes!).
  fs.writeFileSync(path.join(VECTORS, "proof_a.bin"), proofA);
  fs.writeFileSync(path.join(VECTORS, "proof_b.bin"), proofB);
  fs.writeFileSync(path.join(VECTORS, "proof_c.bin"), proofC);
  pub.forEach((v, i) => {
    fs.writeFileSync(path.join(VECTORS, `public_${i}.bin`), fe(v));
  });

  // Verifying-key fixtures (embedded into the contract by src/vk.rs via
  // include_bytes!). Keeping them as .bin avoids giant const arrays in source
  // and keeps the byte conversion in exactly one place (this script).
  if (vk.IC.length !== 3) throw new Error(`expected 3 IC points, got ${vk.IC.length}`);
  fs.writeFileSync(path.join(VECTORS, "vk_alpha_g1.bin"), g1(vk.vk_alpha_1));
  fs.writeFileSync(path.join(VECTORS, "vk_beta_g2.bin"), g2(vk.vk_beta_2));
  fs.writeFileSync(path.join(VECTORS, "vk_gamma_g2.bin"), g2(vk.vk_gamma_2));
  fs.writeFileSync(path.join(VECTORS, "vk_delta_g2.bin"), g2(vk.vk_delta_2));
  vk.IC.forEach((ic, i) => fs.writeFileSync(path.join(VECTORS, `vk_ic${i}_g1.bin`), g1(ic)));

  console.error(
    `wrote fixtures to ${VECTORS}\n` +
    `  proof_a(64) proof_b(128) proof_c(64) public_0..${pub.length - 1}(32)\n` +
    `  vk_alpha_g1(64) vk_{beta,gamma,delta}_g2(128) vk_ic0..2_g1(64)\n` +
    `  G2_ORDERING=${G2_ORDERING} FE_ENDIAN=${FE_ENDIAN} curve=${vk.curve} nPublic=${vk.nPublic}`
  );
}

function hex() {
  const proofPath = process.argv[3];
  const publicPath = process.argv[4];
  if (!proofPath || !publicPath) {
    console.error("usage: node proof_to_bytes.js hex <proof.json> <public.json>");
    process.exit(2);
  }
  const proof = readJSON(proofPath);
  const pub = readJSON(publicPath);
  const h = (b) => "0x" + b.toString("hex");
  process.stdout.write(JSON.stringify({
    proof_a: h(g1(proof.pi_a)),
    proof_b: h(g2(proof.pi_b)),
    proof_c: h(g1(proof.pi_c)),
    public: pub.map((v) => h(fe(v))),
  }) + "\n");
}

const mode = process.argv[2] || "fixtures";
if (mode === "fixtures") fixtures();
else if (mode === "hex") hex();
else {
  console.error(`unknown mode "${mode}" (expected: fixtures | hex)`);
  process.exit(2);
}
