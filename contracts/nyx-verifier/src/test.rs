#![cfg(test)]
//! Contract tests using the REAL Phase-3 proof, fixtures emitted by
//! scripts/proof_to_bytes.js from circuits/{proof,public,verification_key}.json.
//! A passing `valid_proof_verifies` proves the native BN254 pairing ran against
//! the genuine off-chain proof.

use crate::{Error, NyxVerifier, NyxVerifierClient};
use soroban_sdk::{testutils::Address as _, vec, Address, BytesN, Env, Vec};

const PROOF_A: &[u8; 64] = include_bytes!("../test_vectors/proof_a.bin");
const PROOF_B: &[u8; 128] = include_bytes!("../test_vectors/proof_b.bin");
const PROOF_C: &[u8; 64] = include_bytes!("../test_vectors/proof_c.bin");
const PUB0: &[u8; 32] = include_bytes!("../test_vectors/public_0.bin");
const PUB1: &[u8; 32] = include_bytes!("../test_vectors/public_1.bin");

fn setup() -> (Env, NyxVerifierClient<'static>, Address) {
    let env = Env::default();
    let id = env.register(NyxVerifier, ());
    let client = NyxVerifierClient::new(&env, &id);
    let submitter = Address::generate(&env);
    (env, client, submitter)
}

fn pubs(env: &Env) -> Vec<BytesN<32>> {
    vec![
        env,
        BytesN::from_array(env, PUB0),
        BytesN::from_array(env, PUB1),
    ]
}

#[test]
fn valid_proof_verifies() {
    let (env, client, submitter) = setup();
    env.mock_all_auths();
    client.verify_and_settle(
        &submitter,
        &BytesN::from_array(&env, PROOF_A),
        &BytesN::from_array(&env, PROOF_B),
        &BytesN::from_array(&env, PROOF_C),
        &pubs(&env),
    );
    assert!(client.is_settled(
        &BytesN::from_array(&env, PUB0),
        &BytesN::from_array(&env, PUB1)
    ));
}

#[test]
fn tampered_proof_rejected() {
    let (env, client, submitter) = setup();
    env.mock_all_auths();
    let mut a = *PROOF_A;
    a[0] ^= 0x01; // corrupt one byte of proof_a
    let res = client.try_verify_and_settle(
        &submitter,
        &BytesN::from_array(&env, &a),
        &BytesN::from_array(&env, PROOF_B),
        &BytesN::from_array(&env, PROOF_C),
        &pubs(&env),
    );
    // Either a host trap (not on curve) or a failed pairing (InvalidProof) —
    // both mean "did not verify".
    assert!(!matches!(res, Ok(Ok(()))), "tampered proof must not verify");
}

#[test]
fn tampered_public_input_rejected() {
    let (env, client, submitter) = setup();
    env.mock_all_auths();
    let mut p0 = *PUB0;
    p0[31] ^= 0x01;
    let bad = vec![
        &env,
        BytesN::from_array(&env, &p0),
        BytesN::from_array(&env, PUB1),
    ];
    let res = client.try_verify_and_settle(
        &submitter,
        &BytesN::from_array(&env, PROOF_A),
        &BytesN::from_array(&env, PROOF_B),
        &BytesN::from_array(&env, PROOF_C),
        &bad,
    );
    assert!(
        !matches!(res, Ok(Ok(()))),
        "wrong public input must not verify"
    );
}

#[test]
fn wrong_public_input_count_rejected() {
    let (env, client, submitter) = setup();
    env.mock_all_auths();
    let one = vec![&env, BytesN::from_array(&env, PUB0)];
    let res = client.try_verify_and_settle(
        &submitter,
        &BytesN::from_array(&env, PROOF_A),
        &BytesN::from_array(&env, PROOF_B),
        &BytesN::from_array(&env, PROOF_C),
        &one,
    );
    // try_* nests as Result<Result<(), ConversionError>, Result<Error, InvokeError>>:
    // a contract-returned Error surfaces as Err(Ok(Error::X)).
    assert_eq!(res, Err(Ok(Error::InvalidPublicInput)));
}

#[test]
fn replay_rejected() {
    let (env, client, submitter) = setup();
    env.mock_all_auths();
    let a = BytesN::from_array(&env, PROOF_A);
    let b = BytesN::from_array(&env, PROOF_B);
    let c = BytesN::from_array(&env, PROOF_C);
    client.verify_and_settle(&submitter, &a, &b, &c, &pubs(&env)); // first: ok
    let res = client.try_verify_and_settle(&submitter, &a, &b, &c, &pubs(&env));
    assert_eq!(res, Err(Ok(Error::AlreadySettled)));
}

#[test]
fn missing_auth_rejected() {
    let (env, client, submitter) = setup();
    // No mock_all_auths -> submitter.require_auth() traps.
    let res = client.try_verify_and_settle(
        &submitter,
        &BytesN::from_array(&env, PROOF_A),
        &BytesN::from_array(&env, PROOF_B),
        &BytesN::from_array(&env, PROOF_C),
        &pubs(&env),
    );
    assert!(res.is_err(), "missing auth must reject");
}
