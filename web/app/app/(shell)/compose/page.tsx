import type { Metadata } from "next";
import { Topbar } from "../../_components/Topbar";
import { ComposeForm } from "../../_components/ComposeForm";

export const metadata: Metadata = { title: "Nyx — Compose order" };

export default function Compose() {
  return (
    <>
      <Topbar title="Compose order" />
      <ComposeForm />
    </>
  );
}
