import PresetSwatches from "@/components/settings/preset-swatch";
import ThemePreview from "@/components/settings/theme-preview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AppearancePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Preset Theme Swatches</CardTitle>
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
          <CardTitle className="text-lg font-semibold">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemePreview />
        </CardContent>
      </Card>
    </div>
  );
}
