import EmptyState from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export function ModuleOffMessage({ moduleName }: { moduleName: string }) {
  return (
    <div className="p-6">
      <EmptyState
        title={`${moduleName} module is turned off`}
        description="Ask an admin to enable it in Settings → Modules."
      >
        <div className="flex justify-center">
          <Badge tone="off">Off</Badge>
        </div>
      </EmptyState>
    </div>
  );
}
