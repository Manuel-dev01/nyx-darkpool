// Client-side order sealing: compute the Poseidon commitment the Nyx circuit
// expects, so a matched pair can actually be proven on-chain.
//
// This MUST match circuits/scripts/gen_input.js exactly:
//   commitment = F.toObject(poseidon([price, volume, salt])).toString()
// using circomlibjs (the same Poseidon as the in-circuit circomlib). If the
// commitment doesn't equal Poseidon(price,volume,salt), the circuit's
// `maker_hash === hMaker.out` assertion fails during witness calc and the order
// can never produce a proof — so the match would silently never settle.
//
// Values are base-10 integers (the engine + circuit domain): price is scaled to
// integer cents (×100, 2 decimals), size has separators stripped. salt is a
// fresh random field-safe integer.

// Memoize the Poseidon instance (loading its wasm is relatively expensive).
let poseidonPromise: Promise<any> | null = null;
async function getPoseidon() {
  if (!poseidonPromise) {
    poseidonPromise = import("circomlibjs").then((m) => m.buildPoseidon());
  }
  return poseidonPromise;
}

/** Number of decimal places a price is scaled by before integerization. */
export const PRICE_SCALE = 2; // price ×100 → integer "cents"

// The circuit instantiates DarkpoolMatch(64) and range-checks every price/volume
// operand with Num2Bits(64) (circuits/darkpool_match.circom). A value at or above
// 2^64 produces a valid Poseidon commitment but an UNSATISFIABLE witness — the
// order would seal + broadcast, match, then never prove (silently abandoned).
// So a scaled value must be strictly within (0, 2^64) to be provable.
const FIELD_MAX = 1n << 64n;

/** Parse a human price like "99.84" into a base-10 integer string scaled by
 * PRICE_SCALE (→ "9984"). Rejects more than PRICE_SCALE decimals. */
export function priceToInt(human: string): string {
  const s = human.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`invalid price "${human}"`);
  }
  const [whole, frac = ""] = s.split(".");
  if (frac.length > PRICE_SCALE) {
    throw new Error(`price supports at most ${PRICE_SCALE} decimals`);
  }
  const scaled = whole + frac.padEnd(PRICE_SCALE, "0");
  const v = BigInt(scaled);
  if (v <= 0n) throw new Error("price must be greater than 0");
  if (v >= FIELD_MAX) throw new Error("price is too large");
  return v.toString(); // normalize (strip leading zeros)
}

/** Parse a human size like "5,000,000" into a base-10 integer string. */
export function sizeToInt(human: string): string {
  const s = human.trim().replace(/[,\s]/g, "");
  if (!/^\d+$/.test(s)) {
    throw new Error(`invalid size "${human}"`);
  }
  const v = BigInt(s);
  if (v <= 0n) throw new Error("size must be greater than 0");
  if (v >= FIELD_MAX) throw new Error("size is too large");
  return v.toString();
}

/** A fresh, field-safe random salt as a decimal string (64 bits of entropy). */
export function randomSalt(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let v = 0n;
  for (const b of buf) v = (v << 8n) | BigInt(b);
  return v.toString();
}

export interface Sealed {
  priceInt: string;
  volumeInt: string;
  salt: string;
  commitment: string; // decimal Poseidon(price,volume,salt) — the public input
  nullifier: string; // decimal Poseidon(commitment,salt) — anti-replay token
}

/** Seal from already-scaled integer strings (price ×100, raw volume). Generates
 * a fresh salt and the matching Poseidon commitment + nullifier. Used both by
 * seal() and by the demo-mode counterparty (which reuses the stored integers). */
export async function sealInts(priceInt: string, volumeInt: string): Promise<Sealed> {
  const salt = randomSalt();
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  const commitment = F.toObject(
    poseidon([BigInt(priceInt), BigInt(volumeInt), BigInt(salt)]),
  ).toString();
  const nullifier = F.toObject(
    poseidon([BigInt(commitment), BigInt(salt)]),
  ).toString();
  return { priceInt, volumeInt, salt, commitment, nullifier };
}

/** Seal an order: returns the integer values + the Poseidon commitment and a
 * derived nullifier. priceHuman/sizeHuman are the raw form strings. */
export async function seal(priceHuman: string, sizeHuman: string): Promise<Sealed> {
  return sealInts(priceToInt(priceHuman), sizeToInt(sizeHuman));
}
