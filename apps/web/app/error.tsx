"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    console.error("[Route Error]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <p>Please try again or go back.</p>
      <p>
        <small>Reference: {error.digest ?? "N/A"}</small>
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
