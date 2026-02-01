import "server-only";

import { jsPDF } from "jspdf";

import { formatCurrency, formatDate, formatDateTime, normalizeAmount } from "./pdf-format";

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
  doc.text("Payslip", margin, cursorY);
  cursorY += lineHeight + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingSize);
  doc.text("Employee", margin, cursorY);
  cursorY += lineHeight;

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

  drawLine("Earnings", { bold: true, size: headingSize });
  drawLabelValue("Regular Pay", formatCurrency(normalizeAmount(input.regularPay)));
  drawLabelValue("OT Pay", formatCurrency(normalizeAmount(input.overtimePay)));

  cursorY += sectionGap;

  drawLine("Deductions", { bold: true, size: headingSize });
  if (normalizeAmount(input.undertimeDeduction) > 0) {
    drawLabelValue("Undertime deduction", formatCurrency(normalizeAmount(input.undertimeDeduction)));
  }
  if (input.deductions.length === 0) {
    if (normalizeAmount(input.undertimeDeduction) <= 0) {
      drawLine("No manual deductions.");
    }
  } else {
    input.deductions.forEach((deduction) => {
      ensureSpace();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodySize);
      doc.text(deduction.label, margin, cursorY);
      doc.text(formatCurrency(normalizeAmount(deduction.amount)), pageWidth - margin, cursorY, {
        align: "right",
      });
      cursorY += lineHeight;
    });
  }

  drawLabelValue("Total Deductions", formatCurrency(normalizeAmount(input.deductionsTotal)));

  cursorY += sectionGap;

  drawLine("Totals", { bold: true, size: headingSize });
  drawLabelValue("Gross Pay", formatCurrency(normalizeAmount(input.grossPay)));
  drawLabelValue("Net Pay", formatCurrency(normalizeAmount(input.netPay)));

  const signatureDate = input.postedAt ?? input.finalizedAt;
  const signatureLabel = input.postedAt ? "Posted" : "Finalized";

  cursorY += sectionGap * 2;

  ensureSpace(4);
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
