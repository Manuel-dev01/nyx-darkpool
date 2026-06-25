//go:build integration

// Integration tests for the Phase-5 matcher. They exercise the real SQL and the
// SERIALIZABLE pairing path against a live PostgreSQL (gated on NYX_TEST_DB_URL),
// and — when the circuit is compiled — the snarkjs proof path end to end.
//
//	NYX_TEST_DB_URL=... go test -race -tags=integration -p 1 ./internal/matcher/...
package matcher

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/nyx-darkpool/engine/internal/db"
	"github.com/nyx-darkpool/engine/internal/onchain"
	"github.com/nyx-darkpool/engine/internal/order"
	"github.com/nyx-darkpool/engine/internal/prove"
	"github.com/nyx-darkpool/engine/internal/secret"
	"github.com/nyx-darkpool/engine/internal/store"
)

func testDB(t *testing.T) (*db.DB, *store.Store) {
	t.Helper()
	url := os.Getenv("NYX_TEST_DB_URL")
	if url == "" {
		t.Skip("NYX_TEST_DB_URL not set; skipping matcher integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	d, err := db.Connect(ctx, url, 8, nil)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(d.Close)
	applyMigrations(t, d)
	// Use a real (ephemeral) cipher so the integration path exercises at-rest
	// encryption end to end — orders are sealed on insert and opened on read.
	cipher, err := secret.NewEphemeral()
	if err != nil {
		t.Fatalf("cipher: %v", err)
	}
	return d, store.New(d, cipher)
}

func repoRoot(t *testing.T) string {
	t.Helper()
	wd, _ := os.Getwd() // engine/internal/matcher
	return filepath.Clean(filepath.Join(wd, "..", "..", ".."))
}

func applyMigrations(t *testing.T, d *db.DB) {
	t.Helper()
	mig := filepath.Join(repoRoot(t), "engine", "db", "migrations")
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
	run("000002_order_commitment.down.sql", false)
	run("000001_init_schema.down.sql", false)
	run("000001_init_schema.up.sql", true)
	run("000002_order_commitment.up.sql", true)
	t.Cleanup(func() {
		run("000002_order_commitment.down.sql", false)
		run("000001_init_schema.down.sql", false)
	})
}

var nfSeq int

func seed(t *testing.T, st *store.Store, pair string, side order.Side, price, vol, commitment string) string {
	t.Helper()
	nfSeq++
	id, err := st.InsertOrder(context.Background(), store.InsertParams{
		Pubkey:     "GTEST",
		AssetPair:  pair,
		Side:       side,
		Payload:    order.Payload{Price: price, Volume: vol, Salt: "7"},
		Commitment: commitment,
		Nullifier:  fmt.Sprintf("nf-%d-%d", time.Now().UnixNano(), nfSeq),
	})
	if err != nil {
		t.Fatalf("seed %s order: %v", side, err)
	}
	return id
}

func newMatcher(st *store.Store) *Matcher {
	return New(st, nil, onchain.Config{}, Config{Workers: 2, PollInterval: time.Second}, nil)
}

// TestMatchOnceCreatesMatch: a crossing ask/bid pair is matched and both orders
// flip to 'matched'; a non-crossing pair is left open.
func TestMatchOnceCreatesMatch(t *testing.T) {
	ctx := context.Background()
	d, st := testDB(t)

	seed(t, st, "USDC/TBILL", order.Ask, "100", "50", "c-ask")
	seed(t, st, "USDC/TBILL", order.Bid, "105", "50", "c-bid")
	// non-crossing pair on another pair (ask above bid)
	seed(t, st, "GOLD/USDC", order.Ask, "110", "10", "c-ask2")
	seed(t, st, "GOLD/USDC", order.Bid, "100", "10", "c-bid2")

	m := newMatcher(st)
	if n := m.matchOnce(ctx); n != 1 {
		t.Fatalf("matchOnce created %d matches, want 1", n)
	}

	var matches, open int
	if err := d.Pool.QueryRow(ctx, `SELECT count(*) FROM matches`).Scan(&matches); err != nil {
		t.Fatal(err)
	}
	if matches != 1 {
		t.Fatalf("matches = %d, want 1", matches)
	}
	// The GOLD pair (no cross) must remain open: 2 open orders there.
	if err := d.Pool.QueryRow(ctx, `SELECT count(*) FROM orders WHERE asset_pair='GOLD/USDC' AND status='open'`).Scan(&open); err != nil {
		t.Fatal(err)
	}
	if open != 2 {
		t.Fatalf("open GOLD orders = %d, want 2 (no cross)", open)
	}
}

// TestRacingMatchersNoDoubleMatch: two matchers running matchOnce concurrently
// over the same book must never double-match an order. The DB (SERIALIZABLE +
// UNIQUE maker/taker) guarantees exactly one match per crossing pair.
func TestRacingMatchersNoDoubleMatch(t *testing.T) {
	ctx := context.Background()
	d, st := testDB(t)

	const n = 8
	for i := 0; i < n; i++ {
		seed(t, st, "USDC/TBILL", order.Ask, "100", "50", fmt.Sprintf("ca-%d", i))
		seed(t, st, "USDC/TBILL", order.Bid, "105", "50", fmt.Sprintf("cb-%d", i))
	}

	m1, m2 := newMatcher(st), newMatcher(st)
	var wg sync.WaitGroup
	for _, m := range []*Matcher{m1, m2} {
		wg.Add(1)
		go func(mm *Matcher) {
			defer wg.Done()
			for i := 0; i < 5; i++ {
				mm.matchOnce(ctx)
			}
		}(m)
	}
	wg.Wait()

	// Exactly n matches; every order in at most one match (no double-spend).
	var matches, matchedOrders, dupOrders int
	d.Pool.QueryRow(ctx, `SELECT count(*) FROM matches`).Scan(&matches)
	if matches != n {
		t.Fatalf("matches = %d, want %d", matches, n)
	}
	d.Pool.QueryRow(ctx, `SELECT count(*) FROM orders WHERE status='matched'`).Scan(&matchedOrders)
	if matchedOrders != 2*n {
		t.Fatalf("matched orders = %d, want %d", matchedOrders, 2*n)
	}
	// No order id appears as maker or taker more than once.
	d.Pool.QueryRow(ctx, `
		SELECT count(*) FROM (
			SELECT id FROM (
				SELECT maker_order_id AS id FROM matches
				UNION ALL SELECT taker_order_id FROM matches
			) x GROUP BY id HAVING count(*) > 1
		) y`).Scan(&dupOrders)
	if dupOrders != 0 {
		t.Fatalf("found %d orders in more than one match (double-match!)", dupOrders)
	}
}

// TestProofPipeline: with the circuit compiled, the matcher proves a real match
// and stores a valid Groth16 proof_blob. Skips if artifacts are absent.
func TestProofPipeline(t *testing.T) {
	ctx := context.Background()
	d, st := testDB(t)
	root := repoRoot(t)

	prover, err := prove.New(prove.Config{
		CircuitsRoot: filepath.Join(root, "circuits"),
		ScriptsRoot:  filepath.Join(root, "scripts"),
	})
	if err != nil {
		t.Skipf("proving unavailable (%v); run scripts/compile_circuit.sh", err)
	}

	// Real commitments for a valid crossing pair, computed by gen_input.js.
	in := genValidInput(t, root)
	makerID := seed(t, st, "USDC/TBILL", order.Ask, in.MakerPrice, in.MakerVolume, in.MakerHash)
	takerID := seed(t, st, "USDC/TBILL", order.Bid, in.TakerPrice, in.TakerVolume, in.TakerHash)
	// gen_input uses fixed salts; overwrite the seeded salts to match the commitments.
	mustExec(t, d, `UPDATE orders SET encrypted_blob=$1 WHERE id=$2`, payloadBlob(t, in.MakerPrice, in.MakerVolume, in.MakerSalt), makerID)
	mustExec(t, d, `UPDATE orders SET encrypted_blob=$1 WHERE id=$2`, payloadBlob(t, in.TakerPrice, in.TakerVolume, in.TakerSalt), takerID)

	m := New(st, prover, onchain.Config{}, Config{Workers: 1, PollInterval: time.Second}, nil)
	if n := m.matchOnce(ctx); n != 1 {
		t.Fatalf("matchOnce = %d, want 1", n)
	}
	ids, _ := st.UnprovenMatchIDs(ctx, 10)
	if len(ids) != 1 {
		t.Fatalf("unproven matches = %d, want 1", len(ids))
	}
	m.proveAndSettle(ctx, ids[0])

	var blob []byte
	if err := d.Pool.QueryRow(ctx, `SELECT proof_blob FROM matches WHERE id=$1`, ids[0]).Scan(&blob); err != nil {
		t.Fatal(err)
	}
	if len(blob) == 0 {
		t.Fatal("proof_blob is empty after proveAndSettle")
	}
	var proof struct {
		Protocol string   `json:"protocol"`
		PiA      []string `json:"pi_a"`
	}
	if err := json.Unmarshal(blob, &proof); err != nil {
		t.Fatalf("proof_blob is not valid JSON: %v", err)
	}
	if proof.Protocol != "groth16" || len(proof.PiA) == 0 {
		t.Fatalf("proof_blob is not a Groth16 proof: %+v", proof)
	}
}

// TestProofPipelineOnchain runs the FULL pipeline through the matcher: match →
// prove → on-chain verify_and_settle. Gated on a deployed contract
// (NYX_SOROBAN_CONTRACT_ID); one-shot per fresh contract (the on-chain anti-replay
// rejects re-settling the same commitments). Run via scripts/e2e_onchain.sh env.
func TestProofPipelineOnchain(t *testing.T) {
	oc := onchain.FromEnv()
	if !oc.Enabled {
		t.Skip("NYX_SOROBAN_CONTRACT_ID unset; skipping on-chain auto-settle test")
	}
	ctx := context.Background()
	d, st := testDB(t)
	root := repoRoot(t)

	prover, err := prove.New(prove.Config{
		CircuitsRoot: filepath.Join(root, "circuits"),
		ScriptsRoot:  filepath.Join(root, "scripts"),
	})
	if err != nil {
		t.Skipf("proving unavailable (%v)", err)
	}

	in := genValidInput(t, root)
	makerID := seed(t, st, "USDC/TBILL", order.Ask, in.MakerPrice, in.MakerVolume, in.MakerHash)
	takerID := seed(t, st, "USDC/TBILL", order.Bid, in.TakerPrice, in.TakerVolume, in.TakerHash)
	mustExec(t, d, `UPDATE orders SET encrypted_blob=$1 WHERE id=$2`, payloadBlob(t, in.MakerPrice, in.MakerVolume, in.MakerSalt), makerID)
	mustExec(t, d, `UPDATE orders SET encrypted_blob=$1 WHERE id=$2`, payloadBlob(t, in.TakerPrice, in.TakerVolume, in.TakerSalt), takerID)

	m := New(st, prover, oc, Config{Workers: 1, PollInterval: time.Second}, nil)
	if n := m.matchOnce(ctx); n != 1 {
		t.Fatalf("matchOnce = %d, want 1", n)
	}
	ids, _ := st.UnprovenMatchIDs(ctx, 10)
	if len(ids) != 1 {
		t.Fatalf("unproven matches = %d, want 1", len(ids))
	}
	m.proveAndSettle(ctx, ids[0])

	var status, tx string
	if err := d.Pool.QueryRow(ctx,
		`SELECT onchain_status, COALESCE(settlement_tx,'') FROM matches WHERE id=$1`, ids[0]).
		Scan(&status, &tx); err != nil {
		t.Fatal(err)
	}
	if status != "confirmed" {
		t.Fatalf("onchain_status = %q, want confirmed", status)
	}
	if tx == "" {
		t.Fatal("settlement_tx is empty after on-chain confirm")
	}
	t.Logf("on-chain auto-settle confirmed (tx=%s)", tx)
}

// TestEncryptedBlobIsCiphertext: an order seeded through the normal InsertOrder
// path is stored as ciphertext (the raw encrypted_blob is NOT valid JSON), yet
// the store still decrypts it on read — proving at-rest encryption is active and
// transparent to the matcher.
func TestEncryptedBlobIsCiphertext(t *testing.T) {
	ctx := context.Background()
	d, st := testDB(t)

	id := seed(t, st, "USDC/TBILL", order.Ask, "9984", "5000000", "c-enc")

	// Raw column bytes must be ciphertext: not valid JSON, and not containing the
	// cleartext value "9984".
	var raw []byte
	if err := d.Pool.QueryRow(ctx, `SELECT encrypted_blob FROM orders WHERE id=$1`, id).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	if json.Valid(raw) {
		t.Fatal("encrypted_blob is valid JSON — at rest it should be ciphertext")
	}
	if bytes.Contains(raw, []byte("9984")) {
		t.Fatal("encrypted_blob contains the cleartext price — not encrypted")
	}

	// Round-trip through the store: the matcher path decrypts transparently.
	orders, err := st.OpenOrdersByPair(ctx, "USDC/TBILL")
	if err != nil {
		t.Fatal(err)
	}
	if len(orders) != 1 {
		t.Fatalf("OpenOrdersByPair = %d orders, want 1", len(orders))
	}
	if orders[0].Payload.Price != "9984" || orders[0].Payload.Volume != "5000000" {
		t.Fatalf("decrypted payload mismatch: %+v", orders[0].Payload)
	}
}

// --- helpers for the proof test ------------------------------------------------

type sampleInput struct {
	MakerHash, TakerHash     string
	MakerPrice, TakerPrice   string
	MakerVolume, TakerVolume string
	MakerSalt, TakerSalt     string
}

func genValidInput(t *testing.T, root string) sampleInput {
	t.Helper()
	out, err := exec.Command("node", filepath.Join("scripts", "gen_input.js"), "valid").Output()
	cmdDir := filepath.Join(root, "circuits")
	if err != nil {
		// retry with explicit dir
		c := exec.Command("node", filepath.Join("scripts", "gen_input.js"), "valid")
		c.Dir = cmdDir
		out, err = c.Output()
		if err != nil {
			t.Skipf("gen_input.js unavailable: %v", err)
		}
	}
	var raw struct {
		MakerHash   string `json:"maker_hash"`
		TakerHash   string `json:"taker_hash"`
		MakerPrice  string `json:"maker_price"`
		TakerPrice  string `json:"taker_price"`
		MakerVolume string `json:"maker_volume"`
		TakerVolume string `json:"taker_volume"`
		MakerSalt   string `json:"maker_salt"`
		TakerSalt   string `json:"taker_salt"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		t.Fatalf("parse gen_input: %v\n%s", err, out)
	}
	return sampleInput(raw)
}

func payloadBlob(t *testing.T, price, vol, salt string) []byte {
	t.Helper()
	b, err := order.Encode(order.Payload{Price: price, Volume: vol, Salt: salt})
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func mustExec(t *testing.T, d *db.DB, sql string, args ...any) {
	t.Helper()
	if _, err := d.Pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("exec: %v", err)
	}
}
