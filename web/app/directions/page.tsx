import type { Metadata } from "next";
import { Design } from "../_lib/design";

export const metadata: Metadata = {
  title: "Nyx Darkpool — Structural Directions",
};

export default function Page() {
  return <Design file="directions.html" />;
}
