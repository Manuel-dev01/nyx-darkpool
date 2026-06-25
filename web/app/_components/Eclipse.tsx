/**
 * The Nyx eclipse mark — a faint full ring (the whole order book) with one
 * luminous crescent (the single match revealed and proven). Reused across the
 * landing nav/footer/schematic and the app shell.
 */
export function Eclipse({
  size = 20,
  ring = "#23272E",
  crescent = "#3BD7E0",
  strokeWidth = 7,
}: {
  size?: number;
  ring?: string;
  crescent?: string;
  strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", flex: "none" }} aria-hidden="true">
      <circle cx="50" cy="50" r="40" fill="none" stroke={ring} strokeWidth={strokeWidth} />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke={crescent}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="168 252"
        transform="rotate(-62 50 50)"
      />
    </svg>
  );
}
