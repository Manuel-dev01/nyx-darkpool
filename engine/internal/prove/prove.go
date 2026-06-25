// Package prove generates Groth16 proofs for matched orders by shelling out to
// snarkjs (the same toolchain that produced the trusted setup in Phase 3).
//
// The engine is the off-chain prover: given a matched maker/taker pair it builds
// the circuit witness from the orders' raw values (decoded by package order) and
// the public commitments, runs `snarkjs wtns calculate` then `groth16 prove`, and
// returns the proof.json / public.json bytes. Each call runs in its own temp dir
// (os.MkdirTemp) so concurrent matcher workers never clobber one another's
// input/witness/proof files.
package prove

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/nyx-darkpool/engine/internal/onchain"
	"github.com/nyx-darkpool/engine/internal/order"
)

// Config locates the toolchain + circuit artifacts.
type Config struct {
	NodeBin      string // node binary (default "node")
	CircuitsRoot string // path to circuits/ (wasm, zkey, vkey, node_modules)
	ScriptsRoot  string // path to scripts/ (proof_to_bytes.js)
}

// Prover holds resolved, validated paths to the snarkjs CLI and circuit
// artifacts. Construct once at startup and share across workers (it is stateless
// and safe for concurrent use — every call works in a fresh temp dir).
type Prover struct {
	node         string
	cli          string // snarkjs build/cli.cjs
	wasm         string
	zkey         string
	vkey         string
	circuitsDir  string
	proofToBytes string // scripts/proof_to_bytes.js
}

// New resolves the snarkjs CLI and checks the circuit artifacts exist. It
// returns a descriptive error if anything required is missing, so the caller can
// decide whether to run with proving disabled.
func New(cfg Config) (*Prover, error) {
	node := cfg.NodeBin
	if node == "" {
		node = "node"
	}
	circuits, err := filepath.Abs(cfg.CircuitsRoot)
	if err != nil {
		return nil, fmt.Errorf("prove: resolve circuits root: %w", err)
	}

	p := &Prover{
		node:         node,
		wasm:         filepath.Join(circuits, "build", "darkpool_match_js", "darkpool_match.wasm"),
		zkey:         filepath.Join(circuits, "build", "darkpool_match_final.zkey"),
		vkey:         filepath.Join(circuits, "verification_key.json"),
		circuitsDir:  circuits,
		proofToBytes: filepath.Join(cfg.ScriptsRoot, "proof_to_bytes.js"),
	}

	for _, art := range []string{p.wasm, p.zkey, p.vkey} {
		if _, err := os.Stat(art); err != nil {
			return nil, fmt.Errorf("prove: circuit artifact missing (%s); run scripts/compile_circuit.sh: %w", art, err)
		}
	}

	cli, err := resolveSnarkjs(node, circuits)
	if err != nil {
		return nil, err
	}
	p.cli = cli
	return p, nil
}

// Input is the circuit witness: public commitments + the six private values.
// Field order/keys match circuits/scripts/gen_input.js exactly.
type Input struct {
	MakerHash   string `json:"maker_hash"`
	TakerHash   string `json:"taker_hash"`
	MakerPrice  string `json:"maker_price"`
	TakerPrice  string `json:"taker_price"`
	MakerVolume string `json:"maker_volume"`
	TakerVolume string `json:"taker_volume"`
	MakerSalt   string `json:"maker_salt"`
	TakerSalt   string `json:"taker_salt"`
}

// InputFor builds an Input from a matched maker (ask) and taker (bid).
func InputFor(maker, taker order.Order) Input {
	return Input{
		MakerHash:   maker.Commitment,
		TakerHash:   taker.Commitment,
		MakerPrice:  maker.Payload.Price,
		TakerPrice:  taker.Payload.Price,
		MakerVolume: maker.Payload.Volume,
		TakerVolume: taker.Payload.Volume,
		MakerSalt:   maker.Payload.Salt,
		TakerSalt:   taker.Payload.Salt,
	}
}

// Result carries the snarkjs proof + public-signals JSON.
type Result struct {
	ProofJSON  []byte
	PublicJSON []byte
}

// Generate computes the witness and Groth16 proof for in. A non-satisfiable
// input (e.g. a stored commitment that does not equal Poseidon(price,volume,salt),
// or maker_price > taker_price) fails at witness calculation — a wrong proof can
// never be produced.
func (p *Prover) Generate(ctx context.Context, in Input) (Result, error) {
	tmp, err := os.MkdirTemp("", "nyx-prove-*")
	if err != nil {
		return Result{}, fmt.Errorf("prove: temp dir: %w", err)
	}
	defer os.RemoveAll(tmp)

	inputPath := filepath.Join(tmp, "input.json")
	inBytes, _ := json.Marshal(in)
	if err := os.WriteFile(inputPath, inBytes, 0o644); err != nil {
		return Result{}, fmt.Errorf("prove: write input: %w", err)
	}

	witness := filepath.Join(tmp, "witness.wtns")
	proof := filepath.Join(tmp, "proof.json")
	public := filepath.Join(tmp, "public.json")

	if out, err := p.run(ctx, p.cli, "wtns", "calculate", p.wasm, inputPath, witness); err != nil {
		return Result{}, fmt.Errorf("prove: witness calc: %w\n%s", err, out)
	}
	if out, err := p.run(ctx, p.cli, "groth16", "prove", p.zkey, witness, proof, public); err != nil {
		return Result{}, fmt.Errorf("prove: groth16 prove: %w\n%s", err, out)
	}

	proofJSON, err := os.ReadFile(proof)
	if err != nil {
		return Result{}, fmt.Errorf("prove: read proof: %w", err)
	}
	publicJSON, err := os.ReadFile(public)
	if err != nil {
		return Result{}, fmt.Errorf("prove: read public: %w", err)
	}
	return Result{ProofJSON: proofJSON, PublicJSON: publicJSON}, nil
}

// ToHexProof converts a proof + public signals into the 0x-hex BN254 form the
// Soroban contract expects, via scripts/proof_to_bytes.js (the single source of
// truth for the snarkjs-decimal → byte encoding). Used by the on-chain step.
func (p *Prover) ToHexProof(ctx context.Context, r Result) (onchain.Proof, error) {
	tmp, err := os.MkdirTemp("", "nyx-hex-*")
	if err != nil {
		return onchain.Proof{}, fmt.Errorf("prove: temp dir: %w", err)
	}
	defer os.RemoveAll(tmp)

	proofPath := filepath.Join(tmp, "proof.json")
	publicPath := filepath.Join(tmp, "public.json")
	if err := os.WriteFile(proofPath, r.ProofJSON, 0o644); err != nil {
		return onchain.Proof{}, err
	}
	if err := os.WriteFile(publicPath, r.PublicJSON, 0o644); err != nil {
		return onchain.Proof{}, err
	}

	out, err := p.run(ctx, p.proofToBytes, "hex", proofPath, publicPath)
	if err != nil {
		return onchain.Proof{}, fmt.Errorf("prove: proof_to_bytes hex: %w\n%s", err, out)
	}
	var j struct {
		ProofA string   `json:"proof_a"`
		ProofB string   `json:"proof_b"`
		ProofC string   `json:"proof_c"`
		Public []string `json:"public"`
	}
	if err := json.Unmarshal([]byte(out), &j); err != nil {
		return onchain.Proof{}, fmt.Errorf("prove: parse hex output: %w\n%s", err, out)
	}
	return onchain.Proof{A: j.ProofA, B: j.ProofB, C: j.ProofC, Public: j.Public}, nil
}

// run executes `node <args...>` with the circuits dir as cwd (so snarkjs and the
// scripts resolve their node_modules), bounded by ctx.
func (p *Prover) run(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, p.node, args...)
	cmd.Dir = p.circuitsDir
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// resolveSnarkjs finds snarkjs/build/cli.cjs — first via node's require.resolve
// (robust on Windows), then a conventional node_modules path.
func resolveSnarkjs(node, circuits string) (string, error) {
	cmd := exec.Command(node, "-e", "process.stdout.write(require.resolve('snarkjs/build/cli.cjs'))")
	cmd.Dir = circuits
	if out, err := cmd.Output(); err == nil && len(out) > 0 {
		return strings.TrimSpace(string(out)), nil
	}
	fallback := filepath.Join(circuits, "node_modules", "snarkjs", "build", "cli.cjs")
	if _, err := os.Stat(fallback); err != nil {
		return "", fmt.Errorf("prove: snarkjs CLI not found (run npm install in circuits/): %w", err)
	}
	return fallback, nil
}
