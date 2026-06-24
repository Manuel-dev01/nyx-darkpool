#![no_std]
//! Nyx darkpool on-chain settlement layer.
//!
//! `NyxVerifier` re-verifies the off-chain Groth16/BN254 match proof natively
//! using Soroban's BN254 host functions, then records settlement. Order price
//! and volume are never revealed on-chain — only the two Poseidon commitments
//! (maker_hash, taker_hash) are public inputs to the proof.
//!
//! Scope (Phase 4): the verifier is the hardened core. Settlement is a SEAM —
//! `settle_transfer` performs a Stellar Asset Contract transfer with REVEALED
//! amounts, gated by a prior successful verification. A full confidential swap
//! (hidden amounts on-chain) is deferred.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, Vec,
};

mod verifier;
mod vk;

#[cfg(test)]
mod test;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// The Groth16 pairing check failed.
    InvalidProof = 1,
    /// Wrong number of public inputs (must equal the circuit's nPublic).
    InvalidPublicInput = 2,
    /// This (maker_hash, taker_hash) match was already settled (anti-replay).
    AlreadySettled = 3,
    /// Settlement attempted for a pair that was never verified.
    NotSettled = 4,
}

/// Storage keys. Settlement state is keyed by the two public commitments so a
/// match can be settled at most once (anti-replay) and downstream transfers can
/// confirm verification happened.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Marks (maker_hash, taker_hash) as verified + settled.
    Settled(BytesN<32>, BytesN<32>),
}

/// Emitted when a match proof is verified and recorded as settled.
#[contractevent]
pub struct Settled {
    #[topic]
    pub maker_hash: BytesN<32>,
    pub taker_hash: BytesN<32>,
}

#[contract]
pub struct NyxVerifier;

#[contractimpl]
impl NyxVerifier {
    /// Verify a Groth16 match proof and record settlement.
    ///
    /// `submitter` authorizes the settlement state write (the proof is the
    /// cryptographic gate; auth gates who may record it). `public_inputs` must
    /// be `[maker_hash, taker_hash]`.
    pub fn verify_and_settle(
        env: Env,
        submitter: Address,
        proof_a: BytesN<64>,
        proof_b: BytesN<128>,
        proof_c: BytesN<64>,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<(), Error> {
        submitter.require_auth();

        if public_inputs.len() != 2 {
            return Err(Error::InvalidPublicInput);
        }
        let maker = public_inputs.get(0).unwrap();
        let taker = public_inputs.get(1).unwrap();
        let key = DataKey::Settled(maker.clone(), taker.clone());

        // Anti-replay: a match settles at most once.
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadySettled);
        }

        // Cryptographic gate.
        verifier::groth16_verify(&env, &proof_a, &proof_b, &proof_c, &public_inputs)?;

        // Record + announce.
        env.storage().persistent().set(&key, &true);
        Settled {
            maker_hash: maker,
            taker_hash: taker,
        }
        .publish(&env);

        Ok(())
    }

    /// Returns true iff the given match was verified + settled.
    pub fn is_settled(env: Env, maker_hash: BytesN<32>, taker_hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Settled(maker_hash, taker_hash))
    }

    /// Settlement seam: move `amount` of the `sac` asset from `from` to `to`,
    /// gated by a prior successful verification of (maker_hash, taker_hash).
    /// Amounts are revealed here (full confidential settlement is deferred).
    pub fn settle_transfer(
        env: Env,
        maker_hash: BytesN<32>,
        taker_hash: BytesN<32>,
        sac: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), Error> {
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Settled(maker_hash, taker_hash))
        {
            return Err(Error::NotSettled);
        }
        from.require_auth();
        token::Client::new(&env, &sac).transfer(&from, &to, &amount);
        Ok(())
    }
}
