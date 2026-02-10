import KioskClient from "@/app/company/[slug]/kiosk/KioskClient";

export default async function CompanyKioskPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <KioskClient slug={slug} />;
}
