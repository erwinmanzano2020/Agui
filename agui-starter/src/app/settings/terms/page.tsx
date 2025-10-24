import { getTerms } from "./actions";
import TermsForm from "./terms-form";

export const dynamic = "force-dynamic";

export default async function TermsSettingsPage() {
  const initial = await getTerms();
  return (
    <div className="space-y-6">
      <TermsForm initial={initial} />
    </div>
  );
}
