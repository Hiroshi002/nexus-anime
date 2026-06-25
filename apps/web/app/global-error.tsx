"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Global Error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html>
      <body>
        <div role="alert">
          <h2>Something went wrong</h2>
          <p>We have been notified and are working on a fix.</p>
          <p>
            <small>Reference: {error.digest ?? "N/A"}</small>
          </p>
          <Button onClick={reset}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
