import type { Metadata } from "next";

import AppearanceEditor from "./appearance-editor";

export const metadata: Metadata = {
  title: "Appearance settings",
};

export default function AppearancePage() {
  return (
    <div className="space-y-6">
      <AppearanceEditor />
    </div>
  );
}
