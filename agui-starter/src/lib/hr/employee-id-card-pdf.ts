import "server-only";

import { jsPDF } from "jspdf";

import type { EmployeeIdCardRow } from "@/lib/hr/employee-id-cards";
import { orderEmployeeIdCards } from "@/lib/hr/employee-id-cards";
import { createEmployeeQrToken } from "@/lib/hr/kiosk/qr";
import { generateQrPngDataUrl, mapWithConcurrency } from "@/lib/hr/qr-local";

const CR80_WIDTH_MM = 85.6;
const CR80_HEIGHT_MM = 53.98;
const QR_CONCURRENCY = 8;

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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(row.houseName, x + 3, y + 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(row.code, x + 3, y + 12);

  if (row.branchName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Branch: ${row.branchName}`, x + 3, y + 17);
  }

  doc.setDrawColor(120);
  doc.rect(x + 3, y + 20, 30, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("PHOTO", x + 18, y + 30, { align: "center" });
  doc.text("(paste here)", x + 18, y + 35, { align: "center" });

  doc.addImage(qrDataUrl, "PNG", x + 49, y + 16, 32, 32);

  doc.setFontSize(6);
  doc.text("Scan at kiosk", x + 3, y + 48);
  doc.text("If QR is damaged, contact HR for reprint.", x + 3, y + 51.5);
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
