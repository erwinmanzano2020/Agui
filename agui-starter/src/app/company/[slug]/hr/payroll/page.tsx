import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function HrPayrollPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/company/${slug}/hr/payroll-runs`);
}
