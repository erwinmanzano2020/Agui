"use client";

import type { ReactNode } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset?: () => void;
};

export default function GlobalError({ error }: GlobalErrorProps): ReactNode {
  console.error("[global error boundary]", error);

  return (
    <html>
      <body style={{ padding: 24, fontFamily: "ui-sans-serif" }}>
        <h2>Something went wrong</h2>
        <p>Please try again.</p>
      </body>
    </html>
  );
}
