import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Subscription",
};

export default function SubscriptionSettingsPage() {
  return <PlaceholderPage path="/settings/subscription" title="Subscription" />;
}
