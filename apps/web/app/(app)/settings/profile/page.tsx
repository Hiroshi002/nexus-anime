import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Profile settings",
};

export default function ProfileSettingsPage() {
  return <PlaceholderPage path="/settings/profile" title="Profile" />;
}
