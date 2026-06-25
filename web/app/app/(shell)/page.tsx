import type { Metadata } from "next";
import { DeskBody } from "../_components/DeskBody";

export const metadata: Metadata = { title: "Nyx — Desk" };

export default function Desk() {
  return <DeskBody />;
}
