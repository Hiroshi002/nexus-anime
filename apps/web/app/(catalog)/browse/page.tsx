import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Browse",
};

export default function BrowsePage() {
  return <PlaceholderPage path="/browse" title="Browse" />;
}
