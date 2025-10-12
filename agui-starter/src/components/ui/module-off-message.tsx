export function ModuleOffMessage({ moduleName }: { moduleName: string }) {
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl font-semibold">{moduleName} module is turned off</h1>
      <p>Ask an admin to enable it in Settings → Modules.</p>
    </div>
  );
}
