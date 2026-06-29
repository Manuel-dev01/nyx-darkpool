import type { Metadata } from "next";
import { SettledBody } from "../../_components/SettledBody";

export const metadata: Metadata = { title: "Nyx · Settlement" };

export default function Settled() {
  return <SettledBody />;
}
