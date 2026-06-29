"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mono = "'IBM Plex Mono', monospace";

const ITEMS: { label: string; href: string }[] = [
  { label: "Desk", href: "/app" },
  { label: "Compose", href: "/app/compose" },
  { label: "Pool", href: "/app/pool" },
  { label: "Proofs", href: "/app/proofs" },
  { label: "Settled", href: "/app/settled" },
  { label: "Positions", href: "/app/positions" },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <div className="nyx-shell-nav" style={{ padding: "16px 0", flex: 1 }}>
      {ITEMS.map((it) => {
        const active = it.href === "/app" ? pathname === "/app" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className="nyx-shell-navlink"
            style={{
              display: "block",
              padding: "11px 22px",
              borderLeft: `2px solid ${active ? "#3BD7E0" : "transparent"}`,
              fontFamily: mono,
              fontSize: 12,
              letterSpacing: "0.06em",
              color: active ? "#ECEEF0" : "#565C64",
              textDecoration: "none",
            }}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
