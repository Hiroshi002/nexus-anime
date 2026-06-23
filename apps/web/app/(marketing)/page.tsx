import Link from "next/link";

import { Badge, Button } from "@nexus/ui";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-xl border border-border-subtle bg-void-elevated p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-resonance/10 via-transparent to-rift-gold/5" />
        <div className="relative z-10 max-w-2xl space-y-6">
          <Badge variant="resonance">Nexus Resonance Terminal</Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
            Discover anime with console-grade polish
          </h1>
          <p className="font-body text-lg text-text-secondary">
            A cinematic streaming portal for players and fans — deep void surfaces, resonance
            glow, and frictionless discovery.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/browse">
              <Button size="lg">Explore catalog</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="secondary" size="lg">
                View pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-text-primary">Coming in Sprint 3</h2>
        <p className="text-text-secondary">
          Hero banner and content shelves will appear here once the catalog UI ships.
        </p>
      </section>
    </div>
  );
}
