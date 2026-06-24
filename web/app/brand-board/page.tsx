import type { Metadata } from "next";
import { Design } from "../_lib/design";

export const metadata: Metadata = {
  title: "Nyx Darkpool — Brand Board",
};

export default function Page() {
  return <Design file="brand-board.html" />;
}
