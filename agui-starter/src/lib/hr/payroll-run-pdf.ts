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
  const labelSize = 10;
  const cardPadding = 10;
  const cardLineGap = 4;
  const cardBorderWidth = 0.6;

  let cursorY = margin;

  const ensureSpace = (lines = 1) => {
    if (cursorY + lineHeight * lines > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
  };

  const drawLabelValue = (label: string, value: string) => {
    ensureSpace();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    doc.text(label, margin, cursorY);
    doc.text(value, pageWidth - margin, cursorY, { align: "right" });
    cursorY += lineHeight;
  };

  const drawSectionHeader = (text: string) => {
    ensureSpace();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headingSize);
    doc.text(text, margin, cursorY);
    cursorY += lineHeight;
  };

  const drawKeyValueRow = (label: string, value: string) => {
    ensureSpace();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(labelSize);
    doc.text(label, margin + cardPadding, cursorY);
    doc.setFont("courier", "normal");
    doc.setFontSize(labelSize);
    doc.text(value, pageWidth - margin - cardPadding, cursorY, { align: "right" });
    doc.setFont("helvetica", "normal");
    cursorY += lineHeight - cardLineGap;
  };

  const drawCard = (rows: Array<[string, string]>) => {
    const cardHeight =
      cardPadding * 2 + rows.length * (lineHeight - cardLineGap) + cardLineGap;
    ensureSpace(Math.ceil(cardHeight / lineHeight));
    doc.setDrawColor(200);
    doc.setLineWidth(cardBorderWidth);
    doc.rect(margin, cursorY, pageWidth - margin * 2, cardHeight);
    const startY = cursorY + cardPadding + lineHeight - cardLineGap;
    const originalY = cursorY;
    cursorY = startY;
    rows.forEach(([label, value]) => drawKeyValueRow(label, value));
    cursorY = originalY + cardHeight + sectionGap;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleSize);
  doc.text("Register Summary", margin, cursorY);
  cursorY += lineHeight + 4;

  drawSectionHeader("Run Details");
  drawCard([
    ["House", input.houseName],
    ["Period", `${formatDate(input.periodStart)} – ${formatDate(input.periodEnd)}`],
    ["Run Status", input.runStatus],
    ["Reference Code", input.runReferenceCode ?? "(not posted)"],
  ]);

  drawSectionHeader("Totals");
  drawCard([
    ["Total employees", String(input.summary.totalEmployees)],
    ["Total regular pay", formatCurrency(normalizeAmount(input.summary.totalRegularPay))],
    ["Total OT pay", formatCurrency(normalizeAmount(input.summary.totalOvertimePay))],
    [
      "Total undertime deductions",
      formatCurrency(normalizeAmount(input.summary.totalUndertimeDeductions)),
    ],
    [
      "Total manual deductions",
      formatCurrency(normalizeAmount(input.summary.totalManualDeductions)),
    ],
    ["Total Gross Pay", formatCurrency(normalizeAmount(input.summary.totalGrossPay))],
    ["Total net", formatCurrency(normalizeAmount(input.summary.totalNetPay))],
  ]);

  drawSectionHeader("Diagnostics");
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
