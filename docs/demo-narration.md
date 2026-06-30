# Nyx Darkpool — Demo Narration (what to say, screen by screen)

The **spoken script** to accompany [`demo-script.md`](demo-script.md) (which lists the clicks).
Shot numbers match. Read the **quoted lines aloud**; *italic brackets are stage directions*, not
spoken. It is written to be said naturally, so paraphrase freely. Pacing target: Act 1+2 in ~3 min,
Act 3 in ~3 min, Act 4 as long as the room wants.

---

## The hook (cold open, before you touch anything)

**15-second version:**
> "Two institutions want to cross a large block trade. The catch: the moment a big order hits a public
> book, the market front-runs it. Nyx lets them match in the dark, and proves the trade was fair on a
> public blockchain, without ever revealing the price or the size. Let me show you it actually work."

**40-second version (if you have the room):**
> "Quick problem statement. When a bank or a fund puts real size into a public order book, everyone
> sees it coming, and the price moves against them before they fill. People pay millions to hide that
> intent. The usual fix is a dark pool, but then you have to trust the operator not to cheat, leak, or
> front-run you themselves.
>
> Nyx removes that trust. Two desks place orders whose price and size never leave their browsers.
> An off-chain engine matches them and produces a zero-knowledge proof that they crossed at a valid
> price and volume. Then a smart contract on Stellar re-checks that proof and settles. Nobody, not the
> other desk, not the operator, not the chain, ever learns the numbers. And everything I show you is
> live on a real test network, not a mockup. Let's go."

---

## Act 1 — The desk and the seal

**1.1 · Landing (`/`)** *[point at the page, then click "Request desk access"]*
> "This is the front door. The one idea to hold onto: public order books leak institutional intent, so
> large real-world-asset orders get front-run. Nyx matches privately, and only a proof ever touches the
> chain. Let me onboard a desk."

**1.2 · Desk access (`/app/access`)** *[click Generate, then Authenticate with new key]*
> "To trade, a desk needs an identity. I'll click Generate, and right there in the browser we mint a
> real Stellar keypair. That public G-address is the desk's identity, and it cryptographically signs
> every order this desk sends. In production this would be a wallet like Freighter, so the secret key
> never even touches the page. For the demo it's generated locally, but the signature scheme is the
> real thing. I'll authenticate and we're on the desk."

**1.3 · Compose (`/app/compose`)** *[pick the pair, set BID, type price 99.84, size 5,000,000]*
> "Now I compose an order. I'll pick a tokenized US Treasury bill against USDC, set it to buy, price
> ninety-nine eighty-four, size five million units. Watch this panel on the right as I type: that's the
> Seal Preview, and this string is a real cryptographic commitment, a Poseidon hash of the price, the
> size, and a random salt, computed in my browser with the exact same math the proof circuit uses.
>
> This is the whole privacy claim in one line: the price and the size never leave this device. The only
> thing the network will ever see is this hash."

*[Branch: for the solo flow, continue to Act 2. For the two-desk flow, stop here and set up the second window, then go to Act 3.]*

---

## Act 2 — Solo settle, end to end (Demo-Mode ON)

> "First let me show the whole pipeline in a single flow, so you see every stage. I've left Demo-Mode on,
> which just auto-fills a counterparty so a single order can settle by itself. I'll turn that off for the
> real two-desk version in a minute."

**2.1 · Seal & broadcast** *[click Seal & broadcast]*
> "I broadcast the sealed order. Notice what actually left my browser: the hash, a signature, and which
> market it's in. Never the price, never the size. And here we are in the Pool, my order resting in this
> shielded lattice, searching for a match."

**2.2 · Pool (`/app/pool`)** *[wait ~2.5s for the counter]*
> "A crossing counter-order just landed, signed, opposite side, same size, and the status flips to
> Match Found. Let's watch the proof get built and verified."

**2.3 · Proofs — Match located** *[click View proof]*
> "Stage one, match located: the engine paired my buy with a crossing sell. Now the interesting part."

**2.4 · Proofs — ZK proof generated** *[wait ~3 to 10 seconds]*
> "Stage two: the engine is generating a Groth16 zero-knowledge proof that these two orders genuinely
> cross at a valid price and volume, without encoding what those numbers are. Here's the key property:
> if the committed values were wrong, the proof simply can't be built, the witness calculation fails. So
> a valid proof is itself the guarantee that the seal was honest. And there it is, proof generated."

**2.5 · Proofs — Verifying on-chain** *[wait ~5 to 15 seconds; fill the silence]*
> "Stage three, and this is the one I want you to feel. The engine just submitted that proof to a Soroban
> smart contract on the public Stellar test network. The contract re-runs the elliptic-curve pairing
> check natively, on chain, and only settles if the proof holds.
>
> This pause is real, by the way. We are not animating a spinner. We are waiting for a block to close on
> a live ledger. ... And confirmed."

**2.6 · Proofs — Atomic settlement** *[point at the right panel]*
> "Settlement done. The panel shows the settlement transaction and the on-chain pairing function that
> verified it."

**2.7 · Settled (`/app/settled`)** *[open Settled]*
> "The desk's view flips to Settled atomically. Status confirmed."

**2.8 · Stellar Explorer** *[click View on Stellar Explorer]*
> "And here's the money shot. This is a real transaction on a public explorer, on real testnet, success.
> The operator could not have forged this fill. The chain re-verified the match independently. That is
> the difference between trust me, and prove it."

**2.9 · Download receipt** *[click Download receipt]*
> "And the desk can download a settlement receipt: the match, the transaction, the explorer link. Notice
> what's not in it: the price and the size. Those stay sealed, even in the receipt."

---

## Act 3 — Two desks, manual cross (Demo-Mode OFF)

> "Now the real story. That was one desk with an auto-filled counterparty. Let me do it properly: two
> completely independent desks, in two separate browsers, who settle the same trade and never see each
> other's numbers."

*[Setup, say while arranging the windows:]*
> "Important detail for anyone following along: these have to be two separate browser contexts, a normal
> window and an incognito window, because the desk key lives in browser storage that all tabs of one
> profile share. Two windows side by side. Both have Demo-Mode turned off now, so there is no bot. A real
> second party has to show up."

**3.1 · Window A, Desk 1 identity** *[Generate + authenticate in Window A]*
> "Window A, Desk one. Generate its key, authenticate. This is the buyer."

**3.2 · Window A, Demo-Mode OFF** *[toggle off]*
> "Demo-Mode off. No auto-counterparty. Desk one is on its own until a real seller appears."

**3.3 · Window A, compose** *[same pair, BID, 99.84 x 5,000,000]*
> "Same market as before, buy, ninety-nine eighty-four, five million. There's Desk one's commitment."

**3.4 · Window A, broadcast** *[Seal & broadcast]*
> "Broadcast. And notice it just rests. Searching for a match. Nothing auto-fills it. It will sit here
> until a genuine counterparty crosses it."

**3.5 · Window B, Desk 2 identity** *[Generate + authenticate in Window B]*
> "Now Window B, a completely separate desk, separate key, separate browser. This is the seller."

**3.6 · Window B, Demo-Mode OFF** *[toggle off]*
> "Demo-Mode off here too."

**3.7 · Window B, compose** *[same pair, ASK, 99.84 x 5,000,000]*
> "Same market, but this time sell, same price, same size, because to cross fully the sizes have to match.
> Look at Desk two's commitment: it's a different hash from Desk one, even though the underlying trade is
> identical, because each seal uses a fresh random salt. Neither desk can see, or even guess, the other's
> numbers from the hash."

**3.8 · Window B, broadcast** *[Seal & broadcast; watch both windows]*
> "And I broadcast the sell. Watch both windows at once... and there, within a couple of seconds, both
> flip to Match Found. Two strangers' orders, paired by the engine."

**3.9 · Both windows, Proofs** *[open Proofs in each]*
> "If I open the proof pipeline in each window, they show the same match, and both run through the same
> stages: located, proven, verified on chain."

**3.10 · Both windows, Settled + Explorer** *[open Settled, click the explorer link in each]*
> "Both desks settle against the exact same transaction on the explorer. One fill, one on-chain proof,
> two counterparties who never trusted each other."

**3.11 · The payoff** *[turn to the audience]*
> "And here's the punchline. Desk one never saw Desk two's price or size, and Desk two never saw Desk
> one's. If you queried the engine's order feed right now, you'd get commitments, hashes, and nothing
> else. Two parties, one verifiable fill, zero information leaked to anyone, including us."

**Optional negative shots** *[if someone doubts the matching is real]*
> "And in case you think the matching is hand-waved: watch. If Desk two sets a size that's off by one
> unit, [broadcast] nothing crosses. The model is full-fill, sizes must match exactly. And if Desk two
> picks a different market instead, [broadcast] nothing crosses either. Different books never match. I'll
> set it back, and now it crosses. The engine is enforcing real rules, not theater."

---

## Act 4 — "How do I know it's real?" (the skeptic's act)

> "Everything I claimed is backed by something you can open right now. Let me prove each piece."

**The contract** *[open the engine banner's explorer link to the contract]*
> "Here's the actual verifier contract deployed on testnet, with verify-and-settle right there in its
> interface. That's the thing the proof gets checked against."

**The transaction** *[the settlement tx on stellar.expert]*
> "Here's the settlement transaction we just made, status success, on a real ledger. Not a recording, not
> a fixture."

**Anti-replay** *[talk over the explorer]*
> "You can't replay a settlement either. The contract records a marker over the proof's public inputs, so
> submitting the same match twice is rejected as already-settled, and the database enforces the same thing
> with unique constraints and a nullifier per order."

**Privacy at rest**
> "And it's private even in our own database. The order's private values are encrypted at rest with
> AES-256, with an ephemeral key by default, so no secret sits on disk. If someone dumped our database,
> they'd get commitments and ciphertext. The chain only ever saw the commitment and the proof."

**Authenticity**
> "Every order is signed with the desk's Stellar key and verified by the engine, so you can't spoof an
> order on someone else's behalf."

**Be honest about the seams** *[this builds trust, don't skip it]*
> "Let me be straight about what's production-real and what's a demo seam, because honesty is the point.
> Real: the commitments, the Groth16 proofs, the on-chain verification and settlement on testnet, the
> signatures, the at-rest encryption. The seams: the desk's secret key lives in browser storage here
> instead of a hardware wallet, that's a one-line swap to Freighter, and the actual token transfer of the
> two asset legs is the documented next step behind the settlement hook. The hard part, proving and
> verifying a private match on chain, is done and live."

---

## Closing line

> "So that's Nyx. Two institutions cross a block trade in the dark. The price and the size never leave
> their browsers. The chain sees only a hash and a proof, and still guarantees the fill is real. Private
> by construction, verifiable by anyone. Happy to dig into any layer you want."

---

## If something goes wrong (recovery lines, say them calmly)

- **Cold start / first call is slow:** *"The engine is on a free tier that sleeps when idle, so the first
  request is waking it up. Give it a few seconds, this is a hosting choice, not the protocol."*
- **"Verifying on-chain" takes a while:** *"That's a real testnet ledger closing. Live networks have
  their own pace, that's the honest cost of settling on chain instead of pretending to."*
- **Nothing crosses in Act 3:** *"Two things to check live: both desks have to be on the same market, and
  the sizes have to match exactly. Let me line those up."* *[fix pair/size, rebroadcast]*
- **Testnet reset (explorer 404s):** *"Testnet occasionally resets; our tooling redeploys and re-funds
  automatically."* *[off-camera: re-run `make demo`, update the link]*
