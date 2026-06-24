import type { Metadata } from "next";
import { Design } from "./_lib/design";

export const metadata: Metadata = {
  title: "Nyx Darkpool — Trade in the dark",
};

// Homepage = the marketing landing. Its "Four steps. Nothing revealed." section
// uses the Schematic settlement-path node graph (Direction C from Nyx Directions),
// swapped in for the landing canvas's original row-list. See web/README.md.
export default function Page() {
  return <Design file="landing.html" />;
}
