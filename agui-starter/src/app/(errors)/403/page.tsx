import type { Metadata } from "next";

import { ForbiddenState } from "@/components/auth/Forbidden";

export const metadata: Metadata = {
  title: "Access denied",
};

export default function ForbiddenPage() {
  return (
    <ForbiddenState
      title="That link is off limits"
      description="You don’t have the required role to open this page. Head back to the launcher or reach out to an administrator."
      actionHref="/"
      actionLabel="Go home"
    />
  );
}
