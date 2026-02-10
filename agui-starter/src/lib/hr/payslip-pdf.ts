import "server-only";

import { jsPDF } from "jspdf";

import { formatDate, formatDateTime, formatMoneyPHP, normalizeAmount } from "./pdf-format";

export type PayslipPdfFormat = "a4" | "letter";

export type PayslipPdfInput = {
  employeeName: string;
  employeeCode?: string | null;
  positionTitle?: string | null;
  periodStart: string;
  periodEnd: string;
  runReferenceCode?: string | null;
  runStatus: string;
  finalizedAt?: string | null;
  postedAt?: string | null;
  paidAt?: string | null;
  regularPay: number;
  overtimePay: number;
  undertimeDeduction: number;
  deductions: { label: string; amount: number }[];
  deductionsTotal: number;
  grossPay: number;
  netPay: number;
  format?: PayslipPdfFormat;
};

export function renderPayslipPdf(
  doc: jsPDF,
  input: PayslipPdfInput,
  options: { startOnNewPage?: boolean } = {},
) {
  if (options.startOnNewPage) {
    doc.addPage();
  }
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const lineHeight = 16;
  const sectionGap = 12;
  const titleSize = 18;
  const headingSize = 13;
  const bodySize = 11;
  const labelSize = 10;
  const tableRowHeight = 16;
  const tableBorderWidth = 0.6;
  const tablePadding = 6;
  const amountFont = "courier";
  const labelColumnWidth = pageWidth - margin * 2 - tablePadding * 2 - 140;

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

  const drawSectionHeader = (text: string) => {
    ensureSpace();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headingSize);
    doc.text(text, margin, cursorY);
    cursorY += lineHeight;
  };

  const drawDivider = () => {
    ensureSpace();
    doc.setDrawColor(220);
    doc.setLineWidth(tableBorderWidth);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += lineHeight / 2;
  };

  const drawTableHeader = (label: string, valueLabel: string) => {
    ensureSpace();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(labelSize);
    doc.text(label, margin + tablePadding, cursorY);
    doc.text(valueLabel, pageWidth - margin - tablePadding, cursorY, { align: "right" });
    cursorY += tableRowHeight;
  };

  const drawTableRow = (label: string, value: string) => {
    const wrappedLines = doc.splitTextToSize(label, labelColumnWidth) as string[];
    const rowHeight = tableRowHeight * Math.max(1, wrappedLines.length);
    ensureSpace(Math.ceil(rowHeight / lineHeight));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(labelSize);
    doc.text(wrappedLines, margin + tablePadding, cursorY);
    doc.setFont(amountFont, "normal");
    doc.setFontSize(labelSize);
    doc.text(value, pageWidth - margin - tablePadding, cursorY, { align: "right" });
    doc.setFont("helvetica", "normal");
    cursorY += rowHeight;
  };

  const drawTotalsCard = (rows: Array<[string, string]>) => {
    const cardHeight = rows.length * tableRowHeight + tablePadding * 2;
    ensureSpace(Math.ceil(cardHeight / lineHeight));
    doc.setDrawColor(200);
    doc.setLineWidth(tableBorderWidth);
    doc.rect(margin, cursorY, pageWidth - margin * 2, cardHeight);
    const startY = cursorY + tablePadding + tableRowHeight - 4;
    const originalY = cursorY;
    cursorY = startY;
    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(labelSize);
      doc.text(label, margin + tablePadding, cursorY);
      doc.setFont(amountFont, "bold");
      doc.text(value, pageWidth - margin - tablePadding, cursorY, { align: "right" });
      cursorY += tableRowHeight;
    });
    cursorY = originalY + cardHeight + sectionGap;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleSize);
  doc.text("Payslip", margin, cursorY);
  cursorY += lineHeight + 4;

  drawSectionHeader("Employee");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodySize);
  doc.text(input.employeeName, margin, cursorY);
  cursorY += lineHeight;

  if (input.employeeCode) {
    drawLine(`Employee Code: ${input.employeeCode}`);
  }

  if (input.positionTitle) {
    drawLine(`Position: ${input.positionTitle}`);
  }

  drawLine(`Period Covered: ${formatDate(input.periodStart)} – ${formatDate(input.periodEnd)}`);
  drawLine(`Run Status: ${input.runStatus}`);

  if (input.runReferenceCode) {
    drawLine(`Run Reference: ${input.runReferenceCode}`);
  }

  if (input.finalizedAt) {
    drawLine(`Finalized: ${formatDateTime(input.finalizedAt)}`);
  }

  if (input.postedAt) {
    drawLine(`Posted: ${formatDateTime(input.postedAt)}`);
  }

  if (input.paidAt) {
    drawLine(`Paid: ${formatDateTime(input.paidAt)}`);
  }

  cursorY += sectionGap;

  drawSectionHeader("Earnings");
  drawTableHeader("Description", "Amount");
  drawDivider();
  drawTableRow("Regular Pay", formatMoneyPHP(normalizeAmount(input.regularPay)));
  drawTableRow("OT Pay", formatMoneyPHP(normalizeAmount(input.overtimePay)));

  cursorY += sectionGap;

  drawSectionHeader("Deductions");
  drawTableHeader("Description", "Amount");
  drawDivider();
  if (normalizeAmount(input.undertimeDeduction) > 0) {
    drawTableRow(
      "Undertime deduction",
      formatMoneyPHP(normalizeAmount(input.undertimeDeduction)),
    );
  }
  if (input.deductions.length === 0) {
    if (normalizeAmount(input.undertimeDeduction) <= 0) {
      drawLine("No manual deductions.");
    }
  } else {
    input.deductions.forEach((deduction) => {
      drawTableRow(deduction.label, formatMoneyPHP(normalizeAmount(deduction.amount)));
    });
  }

  drawDivider();
  drawTableRow("Total Deductions", formatMoneyPHP(normalizeAmount(input.deductionsTotal)));

  cursorY += sectionGap;

  drawSectionHeader("Totals");
  drawTotalsCard([
    ["Total Gross Pay", formatMoneyPHP(normalizeAmount(input.grossPay))],
    ["Net Pay", formatMoneyPHP(normalizeAmount(input.netPay))],
  ]);

  const signatureDate = input.postedAt ?? input.finalizedAt;
  const signatureLabel = input.postedAt ? "Posted" : "Finalized";

  cursorY += sectionGap;

  ensureSpace(5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodySize);
  doc.text("HR Signature: ____________________", margin, cursorY);
  cursorY += lineHeight * 2;
  doc.text("Employee Signature: ________________", margin, cursorY);
  cursorY += lineHeight * 2;
  doc.text(
    `${signatureLabel} Date: ${signatureDate ? formatDate(signatureDate) : "—"}`,
    margin,
    cursorY,
  );
}

export function generatePayslipPdf(input: PayslipPdfInput): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: input.format ?? "a4" });
  renderPayslipPdf(doc, input);
  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buffer);
}
