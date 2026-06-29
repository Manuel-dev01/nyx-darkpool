// Small shared UI helpers for the live product screens.
import { PRICE_SCALE } from "./seal";

/** Shorten a long hex/decimal string for display: "1234…cdef". */
export function shortId(s: string, head = 6, tail = 4): string {
  if (!s) return "—";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Brand colour for an order side. */
export function sideColor(side: string): string {
  return side.toLowerCase() === "ask" ? "#E05A6E" : "#43C08A";
}

/** Brand colour for an order/onchain status. */
export function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "settled":
    case "confirmed":
      return "#3BD7E0";
    case "matched":
    case "submitted":
      return "#43C08A";
    case "failed":
      return "#E05A6E";
    default:
      return "#8A9099"; // open / pending / sealed
  }
}

/** Format an ISO timestamp as HH:MM UTC. */
export function hhmm(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  return d.toISOString().slice(11, 16);
}

/** Render a scaled integer price back to its human decimal (e.g. "9984" → "99.84"). */
export function priceFromInt(intStr: string): string {
  const n = Number(intStr);
  if (!isFinite(n)) return intStr;
  return (n / 10 ** PRICE_SCALE).toFixed(PRICE_SCALE);
}

/** The active order's locally-known details (the private integers stay client-side
 * so the demo-mode counterparty can mirror them). */
export interface ActiveOrder {
  id: string;
  side: "bid" | "ask";
  pair: string;
  priceInt: string;
  volumeInt: string;
}

const ACTIVE_KEY = "nyx.activeOrder";

/** Persist the active order (called at broadcast). Browser only. */
export function setActiveOrder(o: ActiveOrder): void {
  try {
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(o));
  } catch {
    /* storage disabled — non-fatal */
  }
}

/** Read the active order's full meta, or null if absent / legacy bare-id value. */
export function activeOrderMeta(): ActiveOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as ActiveOrder;
    return o && o.id ? o : null;
  } catch {
    return null; // legacy bare id (non-JSON)
  }
}

/** Read the active order id from the URL (?order=) or localStorage. Browser only. */
export function activeOrderId(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("order");
  if (fromUrl) return fromUrl;
  const meta = activeOrderMeta();
  if (meta) return meta.id;
  try {
    return window.localStorage.getItem(ACTIVE_KEY); // legacy bare id
  } catch {
    return null;
  }
}

/** Demo-Mode (auto-fill counterparty) preference — default ON when unset. */
export function demoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem("nyx.demoMode");
    return v === null ? true : v === "1";
  } catch {
    return false;
  }
}

export function setDemoMode(on: boolean): void {
  try {
    window.localStorage.setItem("nyx.demoMode", on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** The Compose form's in-progress draft. Persisted so navigating away (e.g. to
 * the Pool to watch a match) and back doesn't reset the pair/side/price you
 * picked. Note: pair & side are plaintext order routing fields and are NOT part
 * of the Poseidon commitment (which seals price+size+salt) — so they round-trip
 * here purely for UX, not crypto. */
export interface ComposeDraft {
  pair: string;
  side: string; // "BID" | "ASK"
  tif: string; // "GTC" | "IOC" | "1H"
  price: string;
  size: string;
}

const DRAFT_KEY = "nyx.composeDraft";

/** Persist the Compose draft. Browser only. */
export function saveComposeDraft(d: ComposeDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage disabled — non-fatal */
  }
}

/** Read the saved Compose draft, or null if absent/invalid. */
export function loadComposeDraft(): ComposeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as ComposeDraft;
    return d && typeof d.pair === "string" ? d : null;
  } catch {
    return null;
  }
}

/** stellar.expert testnet explorer links. */
export function explorerTxUrl(tx: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${tx}`;
}
