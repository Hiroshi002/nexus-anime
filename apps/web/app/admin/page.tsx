import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return <PlaceholderPage path="/admin" title="Admin dashboard" />;
}
