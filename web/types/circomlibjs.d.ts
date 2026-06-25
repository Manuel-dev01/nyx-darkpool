// circomlibjs ships no type declarations. We use only buildPoseidon() and the
// returned instance's field helper F (F.toObject(...).toString()), mirroring
// circuits/scripts/gen_input.js. Keep this minimal surface typed as needed.
declare module "circomlibjs" {
  interface PoseidonField {
    toObject(x: unknown): bigint;
  }
  interface Poseidon {
    (inputs: Array<bigint | number | string>): unknown;
    F: PoseidonField;
  }
  export function buildPoseidon(): Promise<Poseidon>;
}
