import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "History",
};

export default function HistoryPage() {
  return <PlaceholderPage path="/nexus/history" title="Watch history" />;
}
