import PresetSwatches from "@/components/settings/preset-swatch";
import ThemePreview from "@/components/settings/theme-preview";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function AppearancePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Preset Theme Swatches</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <PresetSwatches />
          <p className="text-xs text-muted-foreground">
            One click applies the preset and saves to your organization.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Preview</h2>
        </CardHeader>
        <CardContent>
          <ThemePreview />
        </CardContent>
      </Card>
    </div>
  );
}
