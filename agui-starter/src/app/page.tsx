import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server";

export default async function RootPage() {
  const { session } = await getServerSession();

  if (!session) {
    redirect(`/welcome?next=${encodeURIComponent("/me")}`);
  }

  redirect("/me");
}
