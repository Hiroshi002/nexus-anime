import Link from "next/link";

import { Badge, Button, Input, PageShell, Skeleton, TopNav } from "@nexus/ui";

export default function DevComponentsPage() {
  return (
    <PageShell header={<TopNav />}>
      <div className="space-y-10">
        <div>
          <p className="font-mono text-xs text-text-muted">Dev only — remove before launch</p>
          <h1 className="font-display text-3xl font-bold">Design system primitives</h1>
        </div>

        <section className="space-y-4">
          <h2 className="font-display text-xl">Button</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button loading>Loading</Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl">Badge</h2>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="resonance">Resonance</Badge>
            <Badge variant="gold">Gold</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </section>

        <section className="max-w-md space-y-4">
          <h2 className="font-display text-xl">Input</h2>
          <Input label="Email" placeholder="you@example.com" helperText="We'll never share your email." />
          <Input label="Password" type="password" error="Password is required" />
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl">Skeleton</h2>
          <div className="grid max-w-2xl gap-4 md:grid-cols-3">
            <Skeleton variant="card" />
            <Skeleton variant="text" />
            <Skeleton variant="hero" />
          </div>
        </section>

        <Link href="/" className="inline-block">
          <Button variant="secondary">Back home</Button>
        </Link>
      </div>
    </PageShell>
  );
}
