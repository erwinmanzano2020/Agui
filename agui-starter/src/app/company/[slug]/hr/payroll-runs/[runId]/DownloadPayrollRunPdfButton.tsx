"use client";

import { Button } from "@/components/ui/button";

type Props = {
  runId: string;
  runStatus: string;
};

export default function DownloadPayrollRunPdfButton({ runId, runStatus }: Props) {
  const isDisabled = runStatus === "draft";
  const tooltip = isDisabled ? "Finalize run first to export" : "Download merged run PDF";
  const href = `/api/hr/payroll-runs/${runId}/pdf`;

  return (
    <div className="flex flex-col items-start gap-2">
      {isDisabled ? (
        <Button type="button" size="sm" variant="outline" disabled title={tooltip}>
          Download Run PDF
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" asChild title={tooltip}>
          <a href={href}>Download Run PDF</a>
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {isDisabled ? "Finalize run first to export." : "Merged register + payslips PDF."}
      </p>
    </div>
  );
}
