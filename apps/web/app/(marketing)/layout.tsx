import { PageShell, TopNav } from "@nexus/ui";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <PageShell header={<TopNav />}>{children}</PageShell>;
}
