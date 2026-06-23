import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Password settings",
};

export default function PasswordSettingsPage() {
  return <PlaceholderPage path="/settings/password" title="Password" />;
}
