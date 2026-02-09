import "server-only";

import { jsPDF } from "jspdf";

import { formatCurrency, formatDate, normalizeAmount } from "./pdf-format";
import { renderPayslipPdf, type PayslipPdfFormat, type PayslipPdfInput } from "./payslip-pdf";

export type PayrollRunPdfSummary = {
  totalEmployees: number;
  totalRegularPay: number;
  totalOvertimePay: number;
  totalUndertimeDeductions: number;
  totalManualDeductions: number;
  totalGrossPay: number;
  totalNetPay: number;
  missingScheduleDays: number;
  correctedSegments: number;
  openSegments: number;
};

export type PayrollRunPdfInput = {
  houseName: string;
  periodStart: string;
  periodEnd: string;
  runStatus: string;
  runReferenceCode?: string | null;
  summary: PayrollRunPdfSummary;
  payslips: PayslipPdfInput[];
  format?: PayslipPdfFormat;
};

export function generatePayrollRunPdf(input: PayrollRunPdfInput): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: input.format ?? "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const lineHeight = 16;
  const sectionGap = 12;
  const titleSize = 18;
  const headingSize = 13;
  const bodySize = 11;

  let cursorY = margin;

  const ensureSpace = (lines = 1) => {
    if (cursorY + lineHeight * lines > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
  };

  const drawLine = (text: string, options: { bold?: boolean; size?: number } = {}) => {
    ensureSpace();
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size ?? bodySize);
    doc.text(text, margin, cursorY);
    cursorY += lineHeight;
  };

  const drawLabelValue = (label: string, value: string) => {
    ensureSpace();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    doc.text(label, margin, cursorY);
    doc.text(value, pageWidth - margin, cursorY, { align: "right" });
    cursorY += lineHeight;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleSize);
  doc.text("Register Summary", margin, cursorY);
  cursorY += lineHeight + 4;

  drawLine(`House: ${input.houseName}`);
  drawLine(`Period: ${formatDate(input.periodStart)} – ${formatDate(input.periodEnd)}`);
  drawLine(`Run Status: ${input.runStatus}`);
  drawLine(`Reference Code: ${input.runReferenceCode ?? "(not posted)"}`);

  cursorY += sectionGap;

  drawLine("Totals", { bold: true, size: headingSize });
  drawLabelValue("Total employees", String(input.summary.totalEmployees));
  drawLabelValue(
    "Total regular pay",
    formatCurrency(normalizeAmount(input.summary.totalRegularPay)),
  );
  drawLabelValue(
    "Total OT pay",
    formatCurrency(normalizeAmount(input.summary.totalOvertimePay)),
  );
  drawLabelValue(
    "Total undertime deductions",
    formatCurrency(normalizeAmount(input.summary.totalUndertimeDeductions)),
  );
  drawLabelValue(
    "Total manual deductions",
    formatCurrency(normalizeAmount(input.summary.totalManualDeductions)),
  );
  drawLabelValue("Total gross", formatCurrency(normalizeAmount(input.summary.totalGrossPay)));
  drawLabelValue("Total net", formatCurrency(normalizeAmount(input.summary.totalNetPay)));

  cursorY += sectionGap;

  drawLine("Diagnostics", { bold: true, size: headingSize });
  drawLabelValue(
    "Missing schedule days",
    String(Math.max(0, Math.floor(input.summary.missingScheduleDays))),
  );
  drawLabelValue(
    "Corrected segments",
    String(Math.max(0, Math.floor(input.summary.correctedSegments))),
  );
  drawLabelValue(
    "Open segments",
    String(Math.max(0, Math.floor(input.summary.openSegments))),
  );

  input.payslips.forEach((payslip) => {
    renderPayslipPdf(doc, payslip, { startOnNewPage: true });
  });

  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buffer);
}
