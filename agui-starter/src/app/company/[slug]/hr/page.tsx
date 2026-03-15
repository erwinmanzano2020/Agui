import { redirect } from "next/navigation";

export default function HrIndexPage({ params }: { params: { slug: string } }) {
  redirect(`/company/${params.slug}/hr/employees`);
}
