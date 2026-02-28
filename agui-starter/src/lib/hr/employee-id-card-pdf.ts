import "server-only";

import { jsPDF } from "jspdf";

import type { EmployeeIdCardRow } from "@/lib/hr/employee-id-cards";
import { orderEmployeeIdCards } from "@/lib/hr/employee-id-cards";
import { createEmployeeQrToken } from "@/lib/hr/kiosk/qr";
import { generateQrPngDataUrl, mapWithConcurrency } from "@/lib/hr/qr-local";

const CR80_WIDTH_MM = 85.6;
const CR80_HEIGHT_MM = 53.98;
const QR_CONCURRENCY = 8;

const SAFE_MARGIN_MM = 3;
const HEADER_HEIGHT_MM = 9;
const HEADER_BG = [55, 65, 81] as const;

function formatValidUntil(value: string | null): string {
  if (!value) {
    return "Valid Until: —";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Valid Until: —";
  }

  const month = parsed.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `Valid Until: ${month} ${parsed.getUTCFullYear()}`;
}

function drawCard(
  doc: jsPDF,
  row: EmployeeIdCardRow,
  qrDataUrl: string,
  x: number,
  y: number,
) {
  doc.setDrawColor(70);
  doc.setLineWidth(0.2);
  doc.rect(x, y, CR80_WIDTH_MM, CR80_HEIGHT_MM);

  doc.setFillColor(...HEADER_BG);
  doc.rect(x, y, CR80_WIDTH_MM, HEADER_HEIGHT_MM, "F");

  const headerCenterY = y + HEADER_HEIGHT_MM / 2 + 1;

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(row.houseName, x + CR80_WIDTH_MM / 2, headerCenterY, { align: "center", baseline: "middle" });
  doc.setTextColor(0, 0, 0);

  const photoX = x + SAFE_MARGIN_MM;
  const photoY = y + HEADER_HEIGHT_MM + 2;
  const photoW = 21;
  const photoH = 28;
  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  doc.rect(photoX, photoY, photoW, photoH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(row.code, photoX, photoY + photoH + 4);

  const centerX = photoX + photoW + 4;
  const centerW = 34;
  const name = row.fullName?.trim() || "Employee Name";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(name, centerX, y + HEADER_HEIGHT_MM + 6.5, { maxWidth: centerW });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(row.position?.trim() || "Staff", centerX, y + HEADER_HEIGHT_MM + 13);

  doc.setFontSize(7);
  doc.text(`Branch: ${row.branchName?.trim() || "Main Branch"}`, centerX, y + HEADER_HEIGHT_MM + 18);

  doc.setFontSize(6.8);
  doc.text(formatValidUntil(row.validUntil), centerX, y + HEADER_HEIGHT_MM + 23);

  const qrSize = 20;
  const qrX = x + CR80_WIDTH_MM - SAFE_MARGIN_MM - qrSize;
  const qrY = y + HEADER_HEIGHT_MM + 3;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("AGUI HR • Scan at kiosk", qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });

  const signatureY = y + CR80_HEIGHT_MM - SAFE_MARGIN_MM - 2.5;
  const sigX = x + SAFE_MARGIN_MM;
  const sigW = 28;
  doc.setFontSize(6);
  doc.text("Employee Signature", sigX, signatureY - 1.8);
  doc.setLineWidth(0.15);
  doc.line(sigX, signatureY, sigX + sigW, signatureY);
}

export async function generateEmployeeIdCardPdf(row: EmployeeIdCardRow): Promise<Uint8Array> {
  const token = createEmployeeQrToken({ employeeId: row.id, houseId: row.houseId });
  const qrDataUrl = await generateQrPngDataUrl(token);

  const doc = new jsPDF({ unit: "mm", format: [CR80_HEIGHT_MM, CR80_WIDTH_MM], orientation: "landscape" });
  drawCard(doc, row, qrDataUrl, 0, 0);

  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buffer);
}

export async function generateEmployeeIdCardsSheetPdf(
  rows: EmployeeIdCardRow[],
  options: { layout?: "a4_9up" | "a4_8up"; includeCutGuides?: boolean } = {},
): Promise<Uint8Array> {
  const sortedRows = orderEmployeeIdCards(rows);
  const layout = options.layout ?? "a4_8up";
  const includeCutGuides = options.includeCutGuides ?? true;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const cols = layout === "a4_9up" ? 3 : 2;
  const rowsPerPage = layout === "a4_9up" ? 3 : 4;
  const horizontalGap = 6;
  const verticalGap = 4;
  const totalWidth = cols * CR80_WIDTH_MM + (cols - 1) * horizontalGap;
  const totalHeight = rowsPerPage * CR80_HEIGHT_MM + (rowsPerPage - 1) * verticalGap;
  const startX = (210 - totalWidth) / 2;
  const startY = (297 - totalHeight) / 2;
  const cardsPerPage = cols * rowsPerPage;

  const qrDataUrls = await mapWithConcurrency(sortedRows, QR_CONCURRENCY, async (row) => {
    const token = createEmployeeQrToken({ employeeId: row.id, houseId: row.houseId });
    return generateQrPngDataUrl(token);
  });

  sortedRows.forEach((row, index) => {
    const pageIndex = Math.floor(index / cardsPerPage);
    const slot = index % cardsPerPage;
    if (slot === 0 && pageIndex > 0) {
      doc.addPage();
    }

    const rowSlot = Math.floor(slot / cols);
    const colSlot = slot % cols;
    const x = startX + colSlot * (CR80_WIDTH_MM + horizontalGap);
    const y = startY + rowSlot * (CR80_HEIGHT_MM + verticalGap);
    drawCard(doc, row, qrDataUrls[index], x, y);

    if (includeCutGuides) {
      doc.setDrawColor(190);
      doc.setLineWidth(0.1);
      doc.line(x - 2, y, x, y);
      doc.line(x, y - 2, x, y);
      doc.line(x + CR80_WIDTH_MM, y - 2, x + CR80_WIDTH_MM, y);
      doc.line(x + CR80_WIDTH_MM, y, x + CR80_WIDTH_MM + 2, y);
      doc.line(x - 2, y + CR80_HEIGHT_MM, x, y + CR80_HEIGHT_MM);
      doc.line(x, y + CR80_HEIGHT_MM, x, y + CR80_HEIGHT_MM + 2);
      doc.line(x + CR80_WIDTH_MM, y + CR80_HEIGHT_MM, x + CR80_WIDTH_MM + 2, y + CR80_HEIGHT_MM);
      doc.line(x + CR80_WIDTH_MM, y + CR80_HEIGHT_MM, x + CR80_WIDTH_MM, y + CR80_HEIGHT_MM + 2);
    }
  });

  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buffer);
}
