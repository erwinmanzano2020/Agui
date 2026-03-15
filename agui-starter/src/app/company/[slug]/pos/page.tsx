import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PosPage({ params }: { params: { slug: string } }) {
  redirect(`/company/${params.slug}/operations/pos`);
}
