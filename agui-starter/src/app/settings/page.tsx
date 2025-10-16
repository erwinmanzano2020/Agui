import { getTheme } from "./actions";
import ThemeEditor from "./theme-editor";
import { Card, CardContent } from "@/components/ui/card";

export default async function SettingsPage() {
  const theme = await getTheme();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <ThemeEditor initial={theme} />

        <Card>
          <CardContent className="space-y-4">
            <div className="text-lg font-semibold">Preview</div>
            <div className="flex gap-3">
              <button className="agui-navlink">Hover me</button>
              <span className="badge badge--on">Open</span>
              <span className="badge badge--off">Off</span>
            </div>
            <input className="agui-input" placeholder="Input preview" />
            <table className="agui-table">
              <thead>
                <tr>
                  <th>Col A</th>
                  <th>Col B</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sample</td>
                  <td>Row</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
