// Typed client for the Nyx engine HTTP API. All calls go to the relative
// /api/engine/* path, which the route handler app/api/engine/[...path]/route.ts
// proxies to the Go engine (reading ENGINE_ORIGIN at request time) — so this works
// identically in `next dev`, `next start`, and on Vercel, with no CORS and no
// hard-coded engine origin in client code.

const BASE = "/api/engine";

/** Shape of POST /orders — the client seals locally and submits the commitment
 * plus the raw values the trusted off-chain engine needs to match and prove.
 * price/volume/salt are base-10 integer strings. */
export interface CreateOrderBody {
  pubkey: string;
  asset_pair: string;
  side: "bid" | "ask";
  price: string;
  volume: string;
  salt: string;
  commitment: string;
  nullifier: string;
  /** base64 ed25519 signature over the commitment, by the keypair behind pubkey. */
  signature?: string;
}

export interface OrderSummary {
  id: string;
  pubkey: string;
  asset_pair: string;
  side: "bid" | "ask";
  commitment: string;
  status: "open" | "matched" | "settled" | "cancelled";
  created_at: string;
  /** id of the match this order belongs to, when matched (engine LEFT JOIN). */
  match_id?: string;
}

export interface Match {
  id: string;
  maker_order_id: string;
  taker_order_id: string;
  has_proof: boolean;
  onchain_status: "pending" | "submitted" | "confirmed" | "failed";
  settlement_tx?: string;
  created_at: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error((body && body.error) || `engine: ${res.status} ${res.statusText}`);
  }
  return body as T;
}

/** POST /orders → returns the new order id. Throws on 4xx/5xx with the engine's
 * error message (e.g. "nullifier already used"). */
export async function createOrder(body: CreateOrderBody): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return jsonOrThrow<{ id: string }>(res);
}

/** GET /orders?limit= → recent orders (no private values). */
export async function listOrders(limit = 100): Promise<OrderSummary[]> {
  const res = await fetch(`${BASE}/orders?limit=${limit}`, { cache: "no-store" });
  const body = await jsonOrThrow<{ orders: OrderSummary[] }>(res);
  return body.orders ?? [];
}

/** GET /matches/{id} → match view, or null on 404. */
export async function getMatch(id: string): Promise<Match | null> {
  const res = await fetch(`${BASE}/matches/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  return jsonOrThrow<Match>(res);
}
