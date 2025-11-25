import { notFound } from "next/navigation";

import { ProductEncodingForm } from "./product-encoding-form";
import { loadBusinessBySlug } from "@/lib/workspaces/server";

export const dynamic = "force-dynamic";

export default async function ProductEncodingPage({ params }: { params: { slug: string } }) {
  const business = await loadBusinessBySlug(params.slug);
  if (!business) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Products</p>
        <h1 className="text-3xl font-semibold text-foreground">Product encoding</h1>
        <p className="text-sm text-muted-foreground">
          Scan a barcode to find an existing product or capture details for a new SKU.
        </p>
      </div>
      <ProductEncodingForm houseId={business.id} />
    </div>
  );
}
