import type { Metadata } from "next";
import { Design } from "../_lib/design";

export const metadata: Metadata = {
  title: "Nyx Darkpool — Application Flow",
};

export default function Page() {
  return <Design file="app.html" />;
}
