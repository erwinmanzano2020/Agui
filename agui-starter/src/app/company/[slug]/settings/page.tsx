export default function CompanySettings() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage roles, preferences, and integrations.</p>
      </header>
      <div className="rounded-2xl border border-border bg-white p-6 text-sm text-muted-foreground shadow-sm">
        Workspace configuration tools will appear here after enabling the corresponding apps.
      </div>
    </div>
  );
}
