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
const DEFAULT_QR_CAPTION = "Scan at kiosk";
const STAFF_ID_SUBTEXT = "STAFF ID";

type FitTextInput = {
  text: string;
  maxWidth: number;
  maxLines: number;
  startFontSize: number;
  minFontSize: number;
};

type FitTextResult = {
  lines: string[];
  fontSize: number;
};

type HouseLogo = {
  dataUrl: string;
  format: "PNG" | "JPEG";
};

function cleanText(text: string | null | undefined): string {
  return text?.trim() ?? "";
}

function formatValidUntil(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const month = parsed.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `Valid Until: ${month} ${parsed.getUTCFullYear()}`;
}

export function fitTextToBox(doc: jsPDF, input: FitTextInput): FitTextResult {
  const rawText = input.text.trim();
  if (!rawText) {
    return { lines: [], fontSize: input.startFontSize };
  }

  for (let fontSize = input.startFontSize; fontSize >= input.minFontSize; fontSize -= 0.2) {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(rawText, input.maxWidth) as string[];
    if (lines.length <= input.maxLines) {
      return { lines, fontSize };
    }
  }

  doc.setFontSize(input.minFontSize);
  const wrapped = doc.splitTextToSize(rawText, input.maxWidth) as string[];
  if (wrapped.length <= input.maxLines) {
    return { lines: wrapped, fontSize: input.minFontSize };
  }

  const kept = wrapped.slice(0, input.maxLines);
  const lastIndex = kept.length - 1;
  let lastLine = kept[lastIndex] ?? "";

  while (lastLine.length > 0) {
    const candidate = `${lastLine.trimEnd()}…`;
    if (doc.getTextWidth(candidate) <= input.maxWidth) {
      kept[lastIndex] = candidate;
      return { lines: kept, fontSize: input.minFontSize };
    }
    lastLine = lastLine.slice(0, -1);
  }

  kept[lastIndex] = "…";
  return { lines: kept, fontSize: input.minFontSize };
}

function getQrCaption(): string {
  const configured = process.env.HR_ID_QR_CAPTION?.trim();
  if (configured) {
    return configured;
  }

  return DEFAULT_QR_CAPTION;
}

async function resolveHouseLogo(logoUrl: string | null, cache: Map<string, HouseLogo | null>): Promise<HouseLogo | null> {
  const url = cleanText(logoUrl);
  if (!url) {
    return null;
  }

  if (cache.has(url)) {
    return cache.get(url) ?? null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      cache.set(url, null);
      return null;
    }

    const contentType = response.headers.get("content-type")?.toLocaleLowerCase() ?? "";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const isJpeg = contentType.includes("jpeg") || contentType.includes("jpg");
    const mimeType = isJpeg ? "image/jpeg" : "image/png";
    const format: "PNG" | "JPEG" = isJpeg ? "JPEG" : "PNG";
    const logo = { dataUrl: `data:${mimeType};base64,${base64}`, format };
    cache.set(url, logo);
    return logo;
  } catch {
    cache.set(url, null);
    return null;
  }
}

function drawCard(
  doc: jsPDF,
  row: EmployeeIdCardRow,
  qrDataUrl: string,
  houseLogo: HouseLogo | null,
  x: number,
  y: number,
) {
  doc.setDrawColor(70);
  doc.setLineWidth(0.2);
  doc.rect(x, y, CR80_WIDTH_MM, CR80_HEIGHT_MM);

  doc.setFillColor(...HEADER_BG);
  doc.rect(x, y, CR80_WIDTH_MM, HEADER_HEIGHT_MM, "F");

  const headerName = cleanText(row.houseName) || "Store";
  const headerTextY = y + 4;
  const headerSubtextY = y + 7.1;

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");

  if (houseLogo) {
    const logoSize = 5.5;
    const logoX = x + SAFE_MARGIN_MM;
    const logoY = y + (HEADER_HEIGHT_MM - logoSize) / 2;
    doc.addImage(houseLogo.dataUrl, houseLogo.format, logoX, logoY, logoSize, logoSize);

    doc.setFontSize(8.6);
    doc.text(headerName, logoX + logoSize + 1.8, headerTextY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.text(STAFF_ID_SUBTEXT, logoX + logoSize + 1.8, headerSubtextY);
  } else {
    doc.setFontSize(9.1);
    doc.text(headerName, x + CR80_WIDTH_MM / 2, headerTextY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.text(STAFF_ID_SUBTEXT, x + CR80_WIDTH_MM / 2, headerSubtextY, { align: "center" });
  }

  doc.setTextColor(0, 0, 0);

  const photoX = x + SAFE_MARGIN_MM;
  const photoY = y + HEADER_HEIGHT_MM + 2;
  const photoW = 21;
  const photoH = 28;
  doc.setDrawColor(110);
  doc.setLineWidth(0.35);
  doc.roundedRect(photoX, photoY, photoW, photoH, 0.9, 0.9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.text("PHOTO", photoX + photoW / 2, photoY + photoH + 3, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);
  doc.text("Paste 1×1 or 2×2", photoX + photoW / 2, photoY + photoH + 5.2, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  doc.text(row.code, photoX, photoY + photoH + 8.2);

  const centerX = photoX + photoW + 4;
  const centerW = 34;
  const name = cleanText(row.fullName) || "Employee Name";

  const nameFit = fitTextToBox(doc, {
    text: name,
    maxWidth: centerW,
    maxLines: 2,
    startFontSize: 11,
    minFontSize: 8,
  });
  const nameLineHeight = 3.9;
  const nameTopY = y + HEADER_HEIGHT_MM + 5.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameFit.fontSize);
  if (nameFit.lines.length > 0) {
    doc.text(nameFit.lines, centerX, nameTopY);
  }

  const nameBlockHeight = nameLineHeight * 2;
  let infoY = nameTopY + nameBlockHeight + 0.2;

  const position = cleanText(row.position);
  if (position) {
    const positionFit = fitTextToBox(doc, {
      text: position,
      maxWidth: centerW,
      maxLines: 1,
      startFontSize: 8.4,
      minFontSize: 7,
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(positionFit.fontSize);
    if (positionFit.lines.length > 0) {
      doc.text(positionFit.lines[0], centerX, infoY);
      infoY += 3.9;
    }
  }

  doc.setFontSize(7);
  doc.text(`Branch: ${cleanText(row.branchName) || "Main Branch"}`, centerX, infoY);
  infoY += 3.7;

  const validUntilLabel = formatValidUntil(row.validUntil);
  if (validUntilLabel) {
    doc.setFontSize(6.8);
    doc.text(validUntilLabel, centerX, infoY);
  }

  const qrSize = 20;
  const qrX = x + CR80_WIDTH_MM - SAFE_MARGIN_MM - qrSize;
  const qrY = y + HEADER_HEIGHT_MM + 3;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);
  doc.text(getQrCaption(), qrX + qrSize / 2, qrY + qrSize + 2.8, { align: "center" });

  const signatureY = y + CR80_HEIGHT_MM - SAFE_MARGIN_MM - 2.5;
  const sigX = x + SAFE_MARGIN_MM;
  const sigW = 28;
  doc.setFontSize(5.4);
  doc.text("Signature", sigX, signatureY - 1.8);
  doc.setLineWidth(0.15);
  doc.line(sigX, signatureY, sigX + sigW, signatureY);
}

export async function generateEmployeeIdCardPdf(row: EmployeeIdCardRow): Promise<Uint8Array> {
  const token = createEmployeeQrToken({ employeeId: row.id, houseId: row.houseId });
  const qrDataUrl = await generateQrPngDataUrl(token);

  const doc = new jsPDF({ unit: "mm", format: [CR80_HEIGHT_MM, CR80_WIDTH_MM], orientation: "landscape" });
  const houseLogo = await resolveHouseLogo(row.houseLogoUrl, new Map());
  drawCard(doc, row, qrDataUrl, houseLogo, 0, 0);

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

  const logoCache = new Map<string, HouseLogo | null>();
  const [qrDataUrls, houseLogos] = await Promise.all([
    mapWithConcurrency(sortedRows, QR_CONCURRENCY, async (row) => {
      const token = createEmployeeQrToken({ employeeId: row.id, houseId: row.houseId });
      return generateQrPngDataUrl(token);
    }),
    mapWithConcurrency(sortedRows, QR_CONCURRENCY, async (row) => resolveHouseLogo(row.houseLogoUrl, logoCache)),
  ]);

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
    drawCard(doc, row, qrDataUrls[index], houseLogos[index], x, y);

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
