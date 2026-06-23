import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Browse by Genre",
};

export default async function GenreBrowsePage({
  params,
}: {
  params: Promise<{ genre: string }>;
}) {
  const { genre } = await params;
  return <PlaceholderPage path={`/browse/${genre}`} title={`Genre: ${genre}`} />;
}
