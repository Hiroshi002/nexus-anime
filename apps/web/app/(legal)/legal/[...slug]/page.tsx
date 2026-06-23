import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Legal",
};

export default async function LegalPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = `/legal/${slug.join("/")}`;
  return <PlaceholderPage path={path} title="Legal" />;
}
