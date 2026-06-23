import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Nexus Hub",
};

export default function NexusHubPage() {
  return <PlaceholderPage path="/nexus" title="Nexus Hub" />;
}
