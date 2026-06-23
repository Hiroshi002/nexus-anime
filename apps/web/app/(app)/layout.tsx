import { PageShell, TopNav } from "@nexus/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <PageShell header={<TopNav />}>{children}</PageShell>;
}
