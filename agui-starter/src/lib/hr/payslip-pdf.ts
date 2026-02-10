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
  const margin = 52;
  const contentWidth = pageWidth - margin * 2;

  const titleSize = 22;
  const subtitleSize = 12;
  const sectionSize = 13;
  const bodySize = 11;
  const tableHeaderSize = 10;
  const tableBodySize = 10;

  const baseLine = 16;
  const rowLine = 15;
  const sectionGap = 12;
  const tablePadding = 8;
  const tableBottomGap = 10;
  const amountColumnWidth = 148;
  const descriptionColumnWidth = contentWidth - amountColumnWidth - tablePadding * 2;

  let cursorY = margin;

  const ensureSpace = (requiredHeight: number, onPageBreak?: () => void) => {
    if (cursorY + requiredHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
      onPageBreak?.();
    }
  };

  const drawHeadingLine = (text: string, value?: string) => {
    ensureSpace(baseLine);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    doc.text(text, margin, cursorY);
    if (value) {
      doc.setFont("courier", "normal");
      doc.text(value, pageWidth - margin, cursorY, { align: "right" });
    }
    cursorY += baseLine;
  };

  const drawSectionHeader = (text: string) => {
    ensureSpace(baseLine + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sectionSize);
    doc.text(text, margin, cursorY);
    cursorY += baseLine;
  };

  const drawTableHeader = () => {
    ensureSpace(rowLine + 10);
    const headerTop = cursorY - rowLine + 2;
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, headerTop, contentWidth, rowLine + 4, "F");
    doc.setDrawColor(225);
    doc.setLineWidth(0.6);
    doc.line(margin, headerTop + rowLine + 4, pageWidth - margin, headerTop + rowLine + 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(tableHeaderSize);
    doc.text("Description", margin + tablePadding, cursorY);
    doc.text("Amount", pageWidth - margin - tablePadding, cursorY, { align: "right" });
    cursorY += rowLine + 2;
  };

  const drawTableRow = (label: string, value: string, options: { forceBold?: boolean } = {}) => {
    doc.setFont("helvetica", options.forceBold ? "bold" : "normal");
    doc.setFontSize(tableBodySize);
    const wrappedLines = doc.splitTextToSize(label, descriptionColumnWidth) as string[];
    const textLines = Math.max(1, wrappedLines.length);
    const rowHeight = textLines * rowLine;

    ensureSpace(rowHeight + 2, drawTableHeader);

    doc.text(wrappedLines, margin + tablePadding, cursorY);
    doc.setFont("courier", options.forceBold ? "bold" : "normal");
    doc.text(value, pageWidth - margin - tablePadding, cursorY, { align: "right" });

    cursorY += rowHeight;

    doc.setDrawColor(235);
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY - 6, pageWidth - margin, cursorY - 6);
  };

  const drawTotalsCard = (rows: Array<[string, string]>) => {
    const rowHeight = rowLine;
    const cardHeight = rows.length * rowHeight + tablePadding * 2;
    ensureSpace(cardHeight + 8);

    doc.setDrawColor(205);
    doc.setLineWidth(0.8);
    doc.rect(margin, cursorY, contentWidth, cardHeight);

    let rowY = cursorY + tablePadding + rowHeight - 4;
    rows.forEach(([label, value], index) => {
      const isNetPay = index === rows.length - 1;
      doc.setFont("helvetica", isNetPay ? "bold" : "normal");
      doc.setFontSize(tableBodySize + (isNetPay ? 1 : 0));
      doc.text(label, margin + tablePadding, rowY);

      doc.setFont("courier", isNetPay ? "bold" : "normal");
      doc.text(value, pageWidth - margin - tablePadding, rowY, { align: "right" });

      if (index < rows.length - 1) {
        doc.setDrawColor(230);
        doc.line(margin, rowY + 4, pageWidth - margin, rowY + 4);
      }
      rowY += rowHeight;
    });

    cursorY += cardHeight + sectionGap;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleSize);
  doc.text("Payslip", margin, cursorY);
  cursorY += baseLine;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(subtitleSize);
  doc.text(`Employee: ${input.employeeName}`, margin, cursorY);
  cursorY += baseLine;

  drawHeadingLine(`Period Covered: ${formatDate(input.periodStart)} – ${formatDate(input.periodEnd)}`);
  drawHeadingLine(`Run Status: ${input.runStatus}`);

  if (input.employeeCode) {
    drawHeadingLine(`Employee Code: ${input.employeeCode}`);
  }

  if (input.positionTitle) {
    drawHeadingLine(`Position: ${input.positionTitle}`);
  }

  if (input.runReferenceCode) {
    drawHeadingLine(`Run Reference: ${input.runReferenceCode}`);
  }

  if (input.finalizedAt) {
    drawHeadingLine(`Finalized: ${formatDateTime(input.finalizedAt)}`);
  }

  if (input.postedAt) {
    drawHeadingLine(`Posted: ${formatDateTime(input.postedAt)}`);
  }

  if (input.paidAt) {
    drawHeadingLine(`Paid: ${formatDateTime(input.paidAt)}`);
  }

  cursorY += sectionGap;

  drawSectionHeader("Earnings");
  drawTableHeader();
  drawTableRow("Regular Pay", formatMoneyPHP(normalizeAmount(input.regularPay)));
  drawTableRow("OT Pay", formatMoneyPHP(normalizeAmount(input.overtimePay)));

  cursorY += tableBottomGap;

  drawSectionHeader("Deductions");
  drawTableHeader();

  if (normalizeAmount(input.undertimeDeduction) > 0) {
    drawTableRow("Undertime deduction", formatMoneyPHP(normalizeAmount(input.undertimeDeduction)));
  }

  if (input.deductions.length === 0) {
    if (normalizeAmount(input.undertimeDeduction) <= 0) {
      drawTableRow("No manual deductions", formatMoneyPHP(0));
    }
  } else {
    input.deductions.forEach((deduction) => {
      drawTableRow(deduction.label, formatMoneyPHP(normalizeAmount(deduction.amount)));
    });
  }

  drawTableRow("Total Deductions", formatMoneyPHP(normalizeAmount(input.deductionsTotal)), {
    forceBold: true,
  });

  cursorY += sectionGap;

  drawSectionHeader("Totals");
  drawTotalsCard([
    ["Total Gross Pay", formatMoneyPHP(normalizeAmount(input.grossPay))],
    ["Total Deductions", formatMoneyPHP(normalizeAmount(input.deductionsTotal))],
    ["Net Pay", formatMoneyPHP(normalizeAmount(input.netPay))],
  ]);

  const signatureDate = input.postedAt ?? input.finalizedAt;
  const signatureLabel = input.postedAt ? "Posted" : "Finalized";

  ensureSpace(baseLine * 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodySize + 1);
  doc.text("HR Signature: ________________________________", margin, cursorY);
  cursorY += baseLine * 2;
  doc.text("Employee Signature: ___________________________", margin, cursorY);
  cursorY += baseLine * 2;
  doc.text(`${signatureLabel} Date: ${signatureDate ? formatDate(signatureDate) : "—"}`, margin, cursorY);
}

export function generatePayslipPdf(input: PayslipPdfInput): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: input.format ?? "a4" });
  renderPayslipPdf(doc, input);
  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buffer);
}
