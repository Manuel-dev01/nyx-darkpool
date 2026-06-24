//go:build integration

// Package e2e holds the off-chain end-to-end proof-pipeline test. It ties
// together every prior phase:
//
//	Phase 2 schema (orders/matches)  ->  commitment (Poseidon, Phase 3)
//	  ->  inline match (stand-in for the Phase-5 matcher, under a SERIALIZABLE tx)
//	  ->  Groth16 witness + proof (snarkjs, Phase 3)
//	  ->  store proof_blob          ->  groth16 verify (off-chain)
//
// The on-chain Soroban verify (Phase 4) is intentionally out of scope and is
// marked with a PHASE-4 HOOK below — that single seam is where verify_and_settle
// will slot in.
//
// Requirements: NYX_TEST_DB_URL set, Node + circuits/node_modules installed, and
// the circuit compiled (run scripts/compile_circuit.sh first — produces the zkey
// and wasm under circuits/build/). Skips cleanly when prerequisites are absent.
//
//	go test -tags=integration ./internal/e2e/...
package e2e

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nyx-darkpool/engine/internal/db"
	"github.com/nyx-darkpool/engine/internal/onchain"
)

// sampleInput mirrors the JSON emitted by circuits/scripts/gen_input.js.
type sampleInput struct {
	MakerHash   string `json:"maker_hash"`
	TakerHash   string `json:"taker_hash"`
	MakerPrice  string `json:"maker_price"`
	TakerPrice  string `json:"taker_price"`
	MakerVolume string `json:"maker_volume"`
	TakerVolume string `json:"taker_volume"`
	MakerSalt   string `json:"maker_salt"`
	TakerSalt   string `json:"taker_salt"`
}

func repoPaths(t *testing.T) (root, circuits string) {
	t.Helper()
	wd, err := os.Getwd() // engine/internal/e2e
	if err != nil {
		t.Fatal(err)
	}
	root = filepath.Clean(filepath.Join(wd, "..", "..", ".."))
	return root, filepath.Join(root, "circuits")
}

// requireArtifacts skips the test if the circuit has not been compiled yet.
func requireArtifacts(t *testing.T, circuits string) (wasm, zkey, vkey string) {
	t.Helper()
	wasm = filepath.Join(circuits, "build", "darkpool_match_js", "darkpool_match.wasm")
	zkey = filepath.Join(circuits, "build", "darkpool_match_final.zkey")
	vkey = filepath.Join(circuits, "verification_key.json")
	for _, p := range []string{wasm, zkey, vkey} {
		if _, err := os.Stat(p); err != nil {
			t.Skipf("circuit artifact missing (%s); run scripts/compile_circuit.sh first", p)
		}
	}
	return
}

// snarkjsCLI resolves the snarkjs CLI entry under circuits/node_modules so we can
// invoke it via `node <cli> ...` (more robust on Windows than npx resolution).
func snarkjsCLI(t *testing.T, circuits string) string {
	t.Helper()
	out, err := exec.Command("node", "-e",
		"process.stdout.write(require.resolve('snarkjs/build/cli.cjs'))").Output()
	if err == nil && len(out) > 0 {
		return strings.TrimSpace(string(out))
	}
	// Fallback: conventional path.
	p := filepath.Join(circuits, "node_modules", "snarkjs", "build", "cli.cjs")
	if _, statErr := os.Stat(p); statErr != nil {
		t.Skipf("snarkjs CLI not found (%v); run npm install in circuits/", err)
	}
	return p
}

func node(t *testing.T, dir string, args ...string) (string, error) {
	t.Helper()
	cmd := exec.Command("node", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func genInput(t *testing.T, circuits, mode string) (string, sampleInput) {
	t.Helper()
	raw, err := node(t, circuits, filepath.Join("scripts", "gen_input.js"), mode)
	if err != nil {
		t.Fatalf("gen_input %s: %v\n%s", mode, err, raw)
	}
	var in sampleInput
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		t.Fatalf("parse gen_input output: %v\n%s", err, raw)
	}
	return raw, in
}

func applyMigrations(t *testing.T, d *db.DB, root string) {
	t.Helper()
	mig := filepath.Join(root, "engine", "db", "migrations")
	run := func(file string, must bool) {
		sql, err := os.ReadFile(filepath.Join(mig, file))
		if err != nil {
			if must {
				t.Fatalf("read %s: %v", file, err)
			}
			return
		}
		if _, err := d.Pool.Exec(context.Background(), string(sql)); err != nil && must {
			t.Fatalf("exec %s: %v", file, err)
		}
	}
	// reset, then up 000001 + 000002
	run("000002_order_commitment.down.sql", false)
	run("000001_init_schema.down.sql", false)
	run("000001_init_schema.up.sql", true)
	run("000002_order_commitment.up.sql", true)
	t.Cleanup(func() {
		run("000002_order_commitment.down.sql", false)
		run("000001_init_schema.down.sql", false)
	})
}

// TestOffchainProofPipeline runs the full happy-path off-chain E2E and asserts
// both the cryptographic outcome and the resulting DB state.
func TestOffchainProofPipeline(t *testing.T) {
	url := os.Getenv("NYX_TEST_DB_URL")
	if url == "" {
		t.Skip("NYX_TEST_DB_URL not set; skipping e2e")
	}
	root, circuits := repoPaths(t)
	wasm, zkey, vkey := requireArtifacts(t, circuits)
	cli := snarkjsCLI(t, circuits)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	d, err := db.Connect(ctx, url, 8, nil)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(d.Close)
	applyMigrations(t, d, root)

	// 1. Commitments for a valid crossing pair.
	inputJSON, in := genInput(t, circuits, "valid")

	// 2. Seed maker (ask) + taker (bid) with their order_commitments, status open.
	var makerID, takerID string
	if err := d.Pool.QueryRow(ctx,
		`INSERT INTO orders (pubkey,asset_pair,side,encrypted_blob,price_hash,volume_hash,nullifier,order_commitment)
		 VALUES ('GMAKER','USDC/TBILL','ask','\x01','ph','vh','nf-e2e-mk',$1) RETURNING id`,
		in.MakerHash).Scan(&makerID); err != nil {
		t.Fatalf("seed maker: %v", err)
	}
	if err := d.Pool.QueryRow(ctx,
		`INSERT INTO orders (pubkey,asset_pair,side,encrypted_blob,price_hash,volume_hash,nullifier,order_commitment)
		 VALUES ('GTAKER','USDC/TBILL','bid','\x02','ph','vh','nf-e2e-tk',$1) RETURNING id`,
		in.TakerHash).Scan(&takerID); err != nil {
		t.Fatalf("seed taker: %v", err)
	}

	// 3. Pair inline under a SERIALIZABLE tx (stands in for the Phase-5 matcher).
	var matchID string
	err = d.WithSerializableTx(ctx, func(tx pgx.Tx) error {
		if e := tx.QueryRow(ctx,
			`INSERT INTO matches (maker_order_id, taker_order_id) VALUES ($1,$2) RETURNING id`,
			makerID, takerID).Scan(&matchID); e != nil {
			return e
		}
		_, e := tx.Exec(ctx, `UPDATE orders SET status='matched' WHERE id = ANY($1)`,
			[]string{makerID, takerID})
		return e
	})
	if err != nil {
		t.Fatalf("inline match: %v", err)
	}

	// 4. Generate witness + proof in a temp dir (don't clobber committed artifacts).
	tmp := t.TempDir()
	inPath := filepath.Join(tmp, "input.json")
	if err := os.WriteFile(inPath, []byte(inputJSON), 0o644); err != nil {
		t.Fatal(err)
	}
	wtns := filepath.Join(tmp, "witness.wtns")
	proof := filepath.Join(tmp, "proof.json")
	public := filepath.Join(tmp, "public.json")

	if out, err := node(t, circuits, cli, "wtns", "calculate", wasm, inPath, wtns); err != nil {
		t.Fatalf("witness calc failed: %v\n%s", err, out)
	}
	if out, err := node(t, circuits, cli, "groth16", "prove", zkey, wtns, proof, public); err != nil {
		t.Fatalf("prove failed: %v\n%s", err, out)
	}

	// 5. Store the proof bytes into matches.proof_blob.
	proofBytes, err := os.ReadFile(proof)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := d.Pool.Exec(ctx, `UPDATE matches SET proof_blob=$1 WHERE id=$2`, proofBytes, matchID); err != nil {
		t.Fatalf("store proof_blob: %v", err)
	}

	// 6. Off-chain verify — the always-on cryptographic gate.
	if out, err := node(t, circuits, cli, "groth16", "verify", vkey, public, proof); err != nil {
		t.Fatalf("groth16 verify FAILED: %v\n%s", err, out)
	}

	// 7. public.json must equal [maker_hash, taker_hash] from the seeded commitments.
	var pub []string
	pj, _ := os.ReadFile(public)
	if err := json.Unmarshal(pj, &pub); err != nil {
		t.Fatalf("parse public.json: %v", err)
	}
	if len(pub) != 2 || pub[0] != in.MakerHash || pub[1] != in.TakerHash {
		t.Fatalf("public inputs %v do not match seeded commitments [%s %s]", pub, in.MakerHash, in.TakerHash)
	}

	// 8. DB state assertions.
	var nMatches int
	if err := d.Pool.QueryRow(ctx, `SELECT count(*) FROM matches`).Scan(&nMatches); err != nil {
		t.Fatal(err)
	}
	if nMatches != 1 {
		t.Fatalf("matches count = %d, want 1", nMatches)
	}
	var nMatched int
	if err := d.Pool.QueryRow(ctx,
		`SELECT count(*) FROM orders WHERE id = ANY($1) AND status='matched'`,
		[]string{makerID, takerID}).Scan(&nMatched); err != nil {
		t.Fatal(err)
	}
	if nMatched != 2 {
		t.Fatalf("matched orders = %d, want 2", nMatched)
	}
	var blobLen int
	if err := d.Pool.QueryRow(ctx,
		`SELECT length(proof_blob) FROM matches WHERE id=$1`, matchID).Scan(&blobLen); err != nil {
		t.Fatal(err)
	}
	if blobLen == 0 {
		t.Fatal("proof_blob is empty")
	}

	// 9. A second match reusing the maker must be rejected by UNIQUE(maker_order_id).
	_, dupErr := d.Pool.Exec(ctx,
		`INSERT INTO matches (maker_order_id, taker_order_id) VALUES ($1,$2)`, makerID, takerID)
	if dupErr == nil {
		t.Fatal("expected duplicate-maker match to be rejected")
	}
	// 23505 = unique_violation
	var pgErr *pgconn.PgError
	if !(errors.As(dupErr, &pgErr) && pgErr.Code == "23505") {
		t.Fatalf("expected unique_violation (23505), got: %v", dupErr)
	}

	// 10. PHASE-4: on-chain Soroban verify_and_settle, gated on NYX_SOROBAN_CONTRACT_ID.
	//     Off-chain gate above always runs; this extends it to the deployed contract.
	oc := onchain.FromEnv()
	if !oc.Enabled {
		t.Log("PHASE-4: NYX_SOROBAN_CONTRACT_ID unset — skipping on-chain verify (off-chain gate passed)")
		return
	}

	if _, err := d.Pool.Exec(ctx, `UPDATE matches SET onchain_status='submitted' WHERE id=$1`, matchID); err != nil {
		t.Fatalf("set submitted: %v", err)
	}

	submitter := stellarAddress(t, oc, oc.Source)
	hexProof := proofToHex(t, root, proof, public)

	txHash, err := oc.VerifyAndSettle(ctx, submitter, hexProof)
	if err != nil {
		_, _ = d.Pool.Exec(ctx, `UPDATE matches SET onchain_status='failed' WHERE id=$1`, matchID)
		t.Fatalf("on-chain verify_and_settle failed: %v", err)
	}

	// Truncate to the settlement_tx column width (VARCHAR(64)); store NULL if empty.
	if len(txHash) > 64 {
		txHash = txHash[:64]
	}
	if _, err := d.Pool.Exec(ctx,
		`UPDATE matches SET onchain_status='confirmed', settlement_tx=NULLIF($1,'') WHERE id=$2`,
		txHash, matchID); err != nil {
		t.Fatalf("update onchain_status: %v", err)
	}

	var st string
	if err := d.Pool.QueryRow(ctx, `SELECT onchain_status FROM matches WHERE id=$1`, matchID).Scan(&st); err != nil {
		t.Fatal(err)
	}
	if st != "confirmed" {
		t.Fatalf("onchain_status = %q, want confirmed", st)
	}
	t.Logf("PHASE-4: on-chain verify_and_settle confirmed (tx=%q)", txHash)
}

// proofToHex runs scripts/proof_to_bytes.js in hex mode to convert the proof +
// public inputs to the 0x-hex form the contract expects (single source of truth
// for the byte encoding).
func proofToHex(t *testing.T, root, proofPath, publicPath string) onchain.Proof {
	t.Helper()
	script := filepath.Join(root, "scripts", "proof_to_bytes.js")
	out, err := exec.Command("node", script, "hex", proofPath, publicPath).CombinedOutput()
	if err != nil {
		t.Fatalf("proof_to_bytes hex: %v\n%s", err, out)
	}
	var j struct {
		ProofA string   `json:"proof_a"`
		ProofB string   `json:"proof_b"`
		ProofC string   `json:"proof_c"`
		Public []string `json:"public"`
	}
	if err := json.Unmarshal(out, &j); err != nil {
		t.Fatalf("parse proof_to_bytes hex output: %v\n%s", err, out)
	}
	return onchain.Proof{A: j.ProofA, B: j.ProofB, C: j.ProofC, Public: j.Public}
}

// stellarAddress resolves a key identity name to its G... address via the CLI.
func stellarAddress(t *testing.T, oc onchain.Config, name string) string {
	t.Helper()
	out, err := exec.Command(oc.Bin, "keys", "address", name).CombinedOutput()
	if err != nil {
		t.Fatalf("resolve stellar address for %q: %v\n%s", name, err, out)
	}
	return strings.TrimSpace(string(out))
}

// TestNegativeCrossRejected proves the circuit enforces the price cross: a pair
// where maker_price > taker_price must make witness calculation fail.
func TestNegativeCrossRejected(t *testing.T) {
	if os.Getenv("NYX_TEST_DB_URL") == "" {
		t.Skip("NYX_TEST_DB_URL not set; skipping e2e")
	}
	_, circuits := repoPaths(t)
	wasm, _, _ := requireArtifacts(t, circuits)
	cli := snarkjsCLI(t, circuits)

	inputJSON, _ := genInput(t, circuits, "bad-cross")
	tmp := t.TempDir()
	inPath := filepath.Join(tmp, "input.json")
	if err := os.WriteFile(inPath, []byte(inputJSON), 0o644); err != nil {
		t.Fatal(err)
	}
	wtns := filepath.Join(tmp, "witness.wtns")

	out, err := node(t, circuits, cli, "wtns", "calculate", wasm, inPath, wtns)
	if err == nil {
		t.Fatalf("expected witness calculation to FAIL for maker_price>taker_price, but it succeeded\n%s", out)
	}
	t.Logf("negative cross correctly rejected by circuit: %s", firstLine(out))
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}
