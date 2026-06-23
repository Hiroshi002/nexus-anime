import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Watchlist",
};

export default function WatchlistPage() {
  return <PlaceholderPage path="/nexus/watchlist" title="Watchlist" />;
}
