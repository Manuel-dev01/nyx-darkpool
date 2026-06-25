"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadDesk } from "../../_lib/desk";

/**
 * Client-side route gate for the product shell: if no desk identity is present
 * (localStorage "nyx.desk"), redirect to /app/access. Renders children only once
 * a desk is confirmed, so unauthenticated screens never flash. /app/access lives
 * outside the (shell) group, so it is not gated.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (loadDesk()) {
      setOk(true);
    } else {
      router.replace("/app/access");
    }
  }, [router]);

  if (!ok) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#3D434B", letterSpacing: "0.1em" }}>
        AUTHENTICATING…
      </div>
    );
  }
  return <>{children}</>;
}
