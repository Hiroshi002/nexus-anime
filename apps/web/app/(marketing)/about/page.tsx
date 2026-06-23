import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return <PlaceholderPage path="/about" title="About Nexus Anime" />;
}
