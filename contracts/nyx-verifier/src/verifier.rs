//! BN254 Groth16 verification core.
//!
//! Implements the Groth16 check using Soroban's native BN254 host functions
//! (Protocol 25/26). The structure mirrors the canonical verifier:
//!
//!   vk_x = IC[0] + Σ pub[i] · IC[i+1]                       (G1 MSM)
//!   e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1   (pairing)
//!
//! Byte formats are the Ethereum-compatible encodings the host enforces:
//! G1 = be(X)||be(Y) (64), G2 = be(X)||be(Y) with each Fp2 = be(c1)||be(c0) (128).
//! The host performs on-curve / subgroup checks when the points are used, so a
//! malformed proof traps or fails the pairing rather than verifying.

use soroban_sdk::crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine};
use soroban_sdk::{vec, BytesN, Env, Vec};

use crate::{vk, Error};

/// Verify the Groth16 proof against the embedded Nyx verifying key.
/// Returns Ok(()) iff the pairing check holds for the given public inputs.
pub fn groth16_verify(
    env: &Env,
    proof_a: &BytesN<64>,
    proof_b: &BytesN<128>,
    proof_c: &BytesN<64>,
    public_inputs: &Vec<BytesN<32>>,
) -> Result<(), Error> {
    let (alpha, beta, gamma, delta, ic) = vk::load(env);

    // nPublic = 2 (maker_hash, taker_hash); IC has nPublic + 1 = 3 points.
    if public_inputs.len() + 1 != ic.len() {
        return Err(Error::InvalidPublicInput);
    }

    let bn = env.crypto().bn254();

    let a = Bn254G1Affine::from_bytes(proof_a.clone());
    let b = Bn254G2Affine::from_bytes(proof_b.clone());
    let c = Bn254G1Affine::from_bytes(proof_c.clone());

    // vk_x = IC[0] + MSM(IC[1..], public_inputs)
    let mut points: Vec<Bn254G1Affine> = Vec::new(env);
    let mut scalars: Vec<Bn254Fr> = Vec::new(env);
    for i in 0..public_inputs.len() {
        points.push_back(ic.get(i + 1).unwrap());
        scalars.push_back(Bn254Fr::from_bytes(public_inputs.get(i).unwrap()));
    }
    let msm = bn.g1_msm(points, scalars);
    let vk_x = bn.g1_add(&ic.get(0).unwrap(), &msm);

    // e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1
    let neg_a = -a;
    let vp1 = vec![env, neg_a, alpha, vk_x, c];
    let vp2 = vec![env, b, beta, gamma, delta];

    if bn.pairing_check(vp1, vp2) {
        Ok(())
    } else {
        Err(Error::InvalidProof)
    }
}
