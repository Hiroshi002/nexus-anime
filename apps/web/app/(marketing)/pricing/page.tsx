import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return <PlaceholderPage path="/pricing" title="Pricing" />;
}
