import Link from "next/link";

import { Button } from "@nexus/ui";

export function PlaceholderPage({ path, title }: { path: string; title?: string }) {
  return (
    <div className="space-y-4">
      <p className="font-mono text-xs uppercase tracking-widest text-text-muted">Route scaffold</p>
      <h1 className="font-display text-3xl font-bold text-text-primary">{title ?? path}</h1>
      <p className="font-body text-text-secondary">
        Placeholder page for <code className="font-mono text-resonance">{path}</code>. Implementation
        ships in a later sprint.
      </p>
      <Link href="/">
        <Button variant="secondary" size="sm">
          Back to home
        </Button>
      </Link>
    </div>
  );
}
