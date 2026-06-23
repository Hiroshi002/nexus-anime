import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return <PlaceholderPage path="/login" title="Log in" />;
}
