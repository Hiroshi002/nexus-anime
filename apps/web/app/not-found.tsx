import Link from "next/link";

import { Button } from "@nexus/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-void-base px-4 text-center">
      <p className="font-mono text-sm text-resonance">404</p>
      <h1 className="font-display text-3xl font-bold text-text-primary">Signal lost in the void</h1>
      <p className="max-w-md text-text-secondary">
        The resonance terminal could not locate this route.
      </p>
      <Link href="/">
        <Button>Return home</Button>
      </Link>
    </div>
  );
}
