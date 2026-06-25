import type { Metadata } from "next";
import { PoolBody } from "../../_components/PoolBody";

export const metadata: Metadata = { title: "Nyx — Pool" };

export default function Pool() {
  return <PoolBody />;
}
