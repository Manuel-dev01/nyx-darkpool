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

/** Read the active order id from the URL (?order=) or localStorage. Browser only. */
export function activeOrderId(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("order");
  if (fromUrl) return fromUrl;
  try {
    return window.localStorage.getItem("nyx.activeOrder");
  } catch {
    return null;
  }
}

/** stellar.expert testnet explorer links. */
export function explorerTxUrl(tx: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${tx}`;
}
