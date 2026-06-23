import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return <PlaceholderPage path="/register" title="Create account" />;
}
