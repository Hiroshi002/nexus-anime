import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Search",
};

export default function SearchPage() {
  return <PlaceholderPage path="/search" title="Search" />;
}
