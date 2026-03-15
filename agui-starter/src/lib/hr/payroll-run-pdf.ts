import "server-only";

import { jsPDF } from "jspdf";

import { formatDate, formatMoneyPHP, normalizeAmount } from "./pdf-format";
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
  includePayslipPages?: boolean;
};

export function generatePayrollRunPdf(input: PayrollRunPdfInput): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: input.format ?? "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 52;
  const contentWidth = pageWidth - margin * 2;
  const baseLine = 16;
  const rowLine = 14;
  const sectionGap = 12;
  const titleSize = 20;
  const sectionSize = 13;
  const bodySize = 11;
  const labelSize = 10;

  const amountColumnWidth = 95;
  const employeeColumnWidth = contentWidth - amountColumnWidth * 4 - 18;

  let cursorY = margin;

  const ensureSpace = (requiredHeight: number, onPageBreak?: () => void) => {
    if (cursorY + requiredHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
      onPageBreak?.();
    }
  };

  const drawSectionHeader = (text: string) => {
    ensureSpace(baseLine + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sectionSize);
    doc.text(text, margin, cursorY);
    cursorY += baseLine;
  };

  const drawInfoCard = (rows: Array<[string, string]>) => {
    const rowHeight = baseLine;
    const cardPadding = 8;
    const cardHeight = rows.length * rowHeight + cardPadding * 2;
    ensureSpace(cardHeight + sectionGap);

    doc.setDrawColor(210);
    doc.setLineWidth(0.8);
    doc.rect(margin, cursorY, contentWidth, cardHeight);

    let rowY = cursorY + cardPadding + rowHeight - 4;
    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(labelSize);
      doc.text(label, margin + cardPadding, rowY);

      doc.setFont("courier", "normal");
      doc.text(value, pageWidth - margin - cardPadding, rowY, { align: "right" });
      rowY += rowHeight;
    });

    cursorY += cardHeight + sectionGap;
  };

  const drawEmployeeTableHeader = () => {
    ensureSpace(rowLine + 12);
    const boxY = cursorY - rowLine + 1;

    doc.setFillColor(245, 245, 245);
    doc.rect(margin, boxY, contentWidth, rowLine + 5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    let x = margin + 6;
    doc.text("Employee / Code", x, cursorY);
    x += employeeColumnWidth;
    doc.text("Regular", x + amountColumnWidth - 6, cursorY, { align: "right" });
    x += amountColumnWidth;
    doc.text("OT", x + amountColumnWidth - 6, cursorY, { align: "right" });
    x += amountColumnWidth;
    doc.text("Gross", x + amountColumnWidth - 6, cursorY, { align: "right" });
    x += amountColumnWidth;
    doc.text("Net", x + amountColumnWidth - 6, cursorY, { align: "right" });

    cursorY += rowLine + 2;
    doc.setDrawColor(225);
    doc.setLineWidth(0.6);
    doc.line(margin, cursorY - 8, pageWidth - margin, cursorY - 8);
  };

  const drawEmployeeTableRow = (payslip: PayslipPdfInput) => {
    const employeeText = `${payslip.employeeName}${payslip.employeeCode ? ` (${payslip.employeeCode})` : ""}`;
    const labelLines = doc.splitTextToSize(employeeText, employeeColumnWidth - 6) as string[];
    const textLines = Math.max(1, labelLines.length);
    const rowHeight = textLines * rowLine;

    ensureSpace(rowHeight + 6, drawEmployeeTableHeader);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let x = margin + 6;
    doc.text(labelLines, x, cursorY);

    doc.setFont("courier", "normal");
    x += employeeColumnWidth;
    doc.text(formatMoneyPHP(normalizeAmount(payslip.regularPay)), x + amountColumnWidth - 6, cursorY, {
      align: "right",
    });
    x += amountColumnWidth;
    doc.text(formatMoneyPHP(normalizeAmount(payslip.overtimePay)), x + amountColumnWidth - 6, cursorY, {
      align: "right",
    });
    x += amountColumnWidth;
    doc.text(formatMoneyPHP(normalizeAmount(payslip.grossPay)), x + amountColumnWidth - 6, cursorY, {
      align: "right",
    });
    x += amountColumnWidth;
    doc.text(formatMoneyPHP(normalizeAmount(payslip.netPay)), x + amountColumnWidth - 6, cursorY, {
      align: "right",
    });

    cursorY += rowHeight;

    doc.setDrawColor(235);
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY - 6, pageWidth - margin, cursorY - 6);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleSize);
  doc.text("Register Summary", margin, cursorY);
  cursorY += baseLine;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodySize + 1);
  doc.text(input.houseName, margin, cursorY);
  cursorY += baseLine + 2;

  drawInfoCard([
    ["Period", `${formatDate(input.periodStart)} – ${formatDate(input.periodEnd)}`],
    ["Run Status", input.runStatus],
    ["Reference Code", input.runReferenceCode ?? "(not posted)"],
  ]);

  drawSectionHeader("Totals");
  drawInfoCard([
    ["Total employees", String(input.summary.totalEmployees)],
    ["Total regular pay", formatMoneyPHP(normalizeAmount(input.summary.totalRegularPay))],
    ["Total OT pay", formatMoneyPHP(normalizeAmount(input.summary.totalOvertimePay))],
    [
      "Total undertime deductions",
      formatMoneyPHP(normalizeAmount(input.summary.totalUndertimeDeductions)),
    ],
    ["Total manual deductions", formatMoneyPHP(normalizeAmount(input.summary.totalManualDeductions))],
    ["Total Gross Pay", formatMoneyPHP(normalizeAmount(input.summary.totalGrossPay))],
    ["Total net", formatMoneyPHP(normalizeAmount(input.summary.totalNetPay))],
  ]);

  drawSectionHeader("Employee Summary");
  drawEmployeeTableHeader();
  input.payslips.forEach((payslip) => drawEmployeeTableRow(payslip));

  cursorY += sectionGap;

  drawSectionHeader("Diagnostics");
  drawInfoCard([
    ["Missing schedule days", String(Math.max(0, Math.floor(input.summary.missingScheduleDays)))],
    ["Corrected segments", String(Math.max(0, Math.floor(input.summary.correctedSegments)))],
    ["Open segments", String(Math.max(0, Math.floor(input.summary.openSegments)))],
  ]);

  if (input.includePayslipPages !== false) {
    input.payslips.forEach((payslip) => {
      renderPayslipPdf(doc, payslip, { startOnNewPage: true });
    });
  }

  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buffer);
}
