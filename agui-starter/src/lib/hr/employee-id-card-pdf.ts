import "server-only";

import { jsPDF } from "jspdf";

import type { EmployeeIdCardRow } from "@/lib/hr/employee-id-cards";
import { orderEmployeeIdCards } from "@/lib/hr/employee-id-cards";
import { createEmployeeQrToken } from "@/lib/hr/kiosk/qr";
import { generateQrPngDataUrl, mapWithConcurrency } from "@/lib/hr/qr-local";

const CR80_LONG_EDGE_MM = 85.6;
const CR80_SHORT_EDGE_MM = 53.98;
const QR_CONCURRENCY = 8;

const SAFE_MARGIN_MM = 3;
const HEADER_HEIGHT_MM = 7.8;
const HEADER_BG = [55, 65, 81] as const;
const HEADER_ACCENT = [191, 161, 92] as const;
const PHOTO_PLATE_BG = [242, 244, 247] as const;
const QR_PLATE_BG = [246, 247, 249] as const;
const DEFAULT_QR_CAPTION = "Scan at kiosk";
const STAFF_ID_SUBTEXT = "STAFF ID";
const MODERN_BRAND_ACCENT = [44, 93, 146] as const;

export type EmployeeIdCardLayout = "classic" | "modern";

const DEFAULT_FRONT_LAYOUT: EmployeeIdCardLayout = "classic";

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

type EmployeePhoto = {
  dataUrl: string;
  format: "PNG" | "JPEG";
};


function cleanText(text: string | null | undefined): string {
  return text?.trim() ?? "";
}

export function getHeaderBrandName(
  brandName: string | null | undefined,
  houseName: string | null | undefined,
): string | null {
  const brand = cleanText(brandName);
  if (brand.length > 0) {
    return brand;
  }

  const house = cleanText(houseName);
  return house.length > 0 ? house : null;
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

export async function resolveHouseLogo(logoUrl: string | null, cache: Map<string, HouseLogo | null>): Promise<HouseLogo | null> {
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

    const contentType = response.headers.get("content-type")?.toLocaleLowerCase().split(";")[0]?.trim() ?? "";
    const isPng = contentType === "image/png";
    const isJpeg = contentType === "image/jpeg" || contentType === "image/jpg";
    if (!isPng && !isJpeg) {
      cache.set(url, null);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
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

async function resolveEmployeePhoto(photoUrl: string | null, cache: Map<string, EmployeePhoto | null>): Promise<EmployeePhoto | null> {
  const url = cleanText(photoUrl);
  if (!url) return null;

  if (cache.has(url)) {
    return cache.get(url) ?? null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      cache.set(url, null);
      return null;
    }

    const contentType = response.headers.get("content-type")?.toLocaleLowerCase().split(";")[0]?.trim() ?? "";
    const isPng = contentType === "image/png";
    const isJpeg = contentType === "image/jpeg" || contentType === "image/jpg";
    if (!isPng && !isJpeg) {
      cache.set(url, null);
      return null;
    }

    const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
    const mimeType = isJpeg ? "image/jpeg" : "image/png";
    const format: "PNG" | "JPEG" = isJpeg ? "JPEG" : "PNG";
    const photo = { dataUrl: `data:${mimeType};base64,${base64}`, format };
    cache.set(url, photo);
    return photo;
  } catch {
    cache.set(url, null);
    return null;
  }
}

function drawFrontClassic(doc: jsPDF, row: EmployeeIdCardRow, houseLogo: HouseLogo | null, employeePhoto: EmployeePhoto | null, x: number, y: number) {
  const cardWidth = CR80_SHORT_EDGE_MM;
  const cardHeight = CR80_LONG_EDGE_MM;

  doc.setDrawColor(70);
  doc.setLineWidth(0.2);
  doc.rect(x, y, cardWidth, cardHeight);

  doc.setFillColor(...HEADER_BG);
  doc.rect(x, y, cardWidth, HEADER_HEIGHT_MM, "F");

  const headerName = getHeaderBrandName(row.houseBrandName, row.houseName);
  const hasHeaderName = headerName !== null;

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");

  if (houseLogo && hasHeaderName) {
    const logoSize = 4.4;
    const logoX = x + SAFE_MARGIN_MM;
    const logoY = y + (HEADER_HEIGHT_MM - logoSize) / 2;
    doc.addImage(houseLogo.dataUrl, houseLogo.format, logoX, logoY, logoSize, logoSize);

    doc.setFontSize(6.6);
    doc.text(headerName, logoX + logoSize + 1.5, y + 3.6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.3);
    doc.text(STAFF_ID_SUBTEXT, logoX + logoSize + 1.5, y + 6.15);
  } else if (hasHeaderName) {
    doc.setFontSize(6.9);
    doc.text(headerName, x + cardWidth / 2, y + 3.6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.3);
    doc.text(STAFF_ID_SUBTEXT, x + cardWidth / 2, y + 6.15, { align: "center" });
  } else {
    doc.setFontSize(5.6);
    doc.text(STAFF_ID_SUBTEXT, x + cardWidth / 2, y + HEADER_HEIGHT_MM / 2 + 0.8, { align: "center", baseline: "middle" });
  }

  doc.setFillColor(...HEADER_ACCENT);
  doc.rect(x, y + HEADER_HEIGHT_MM - 0.5, cardWidth, 0.5, "F");

  const photoPlateW = 33;
  const photoPlateH = 39;
  const photoX = x + (cardWidth - photoPlateW) / 2;
  const photoY = y + HEADER_HEIGHT_MM + 3;
  doc.setFillColor(...PHOTO_PLATE_BG);
  doc.setDrawColor(175);
  doc.setLineWidth(0.25);
  doc.roundedRect(photoX, photoY, photoPlateW, photoPlateH, 1.3, 1.3, "FD");

  const frameInset = 1;
  const frameX = photoX + frameInset;
  const frameY = photoY + frameInset;
  const frameW = photoPlateW - frameInset * 2;
  const frameH = photoPlateH - frameInset * 2;
  doc.setDrawColor(142);
  doc.setLineWidth(0.16);
  doc.rect(frameX, frameY, frameW, frameH);

  if (employeePhoto) {
    doc.addImage(employeePhoto.dataUrl, employeePhoto.format, frameX, frameY, frameW, frameH);
  } else {
    doc.setTextColor(175, 175, 175);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.text("PHOTO", frameX + frameW / 2, frameY + frameH / 2, { align: "center", baseline: "middle" });
  }

  const textWidth = cardWidth - SAFE_MARGIN_MM * 2;
  let textY = photoY + photoPlateH + 4.8;
  const name = cleanText(row.fullName) || "Employee Name";
  const nameFit = fitTextToBox(doc, {
    text: name,
    maxWidth: textWidth,
    maxLines: 2,
    startFontSize: 8.5,
    minFontSize: 6.8,
  });

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameFit.fontSize);
  if (nameFit.lines.length > 0) {
    doc.text(nameFit.lines, x + cardWidth / 2, textY, { align: "center" });
    textY += nameFit.lines.length * 3.4 + 1.8;
  }

  const position = cleanText(row.position);
  if (position) {
    const positionFit = fitTextToBox(doc, {
      text: position,
      maxWidth: textWidth,
      maxLines: 1,
      startFontSize: 6.6,
      minFontSize: 5.8,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(positionFit.fontSize);
    if (positionFit.lines.length > 0) {
      doc.text(positionFit.lines[0], x + cardWidth / 2, textY, { align: "center" });
      textY += 3.4;
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text(cleanText(row.branchName) || "Main Branch", x + cardWidth / 2, textY, { align: "center" });

  const idY = y + cardHeight - SAFE_MARGIN_MM;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.6);
  doc.text("ID", x + SAFE_MARGIN_MM, idY - 2.7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.text(row.code, x + SAFE_MARGIN_MM, idY);
}

function drawFrontModern(doc: jsPDF, row: EmployeeIdCardRow, houseLogo: HouseLogo | null, employeePhoto: EmployeePhoto | null, x: number, y: number) {
  const cardWidth = CR80_SHORT_EDGE_MM;
  const cardHeight = CR80_LONG_EDGE_MM;

  doc.setDrawColor(70);
  doc.setLineWidth(0.2);
  doc.rect(x, y, cardWidth, cardHeight);

  const structuralLineWidth = 0.32;
  const brandLineX = x + SAFE_MARGIN_MM + 2.4;
  const identityDividerY = y + cardHeight * 0.655;

  doc.setDrawColor(...MODERN_BRAND_ACCENT);
  doc.setLineWidth(structuralLineWidth);
  doc.line(brandLineX, y, brandLineX, y + cardHeight);

  doc.setDrawColor(182, 188, 196);
  doc.setLineWidth(structuralLineWidth);
  doc.line(x, identityDividerY, x + cardWidth, identityDividerY);

  const topIdentityX = brandLineX + 2.65;
  const topIdentityY = y + SAFE_MARGIN_MM + 1;
  const headerName = getHeaderBrandName(row.houseBrandName, row.houseName);
  if (houseLogo) {
    const logoSize = 4.3;
    doc.addImage(houseLogo.dataUrl, houseLogo.format, topIdentityX, topIdentityY - 0.5, logoSize, logoSize);
    doc.setTextColor(41, 41, 41);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.text(headerName || STAFF_ID_SUBTEXT, topIdentityX + logoSize + 1.3, topIdentityY + 2.5);
  } else {
    doc.setTextColor(41, 41, 41);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.text(headerName || STAFF_ID_SUBTEXT, topIdentityX, topIdentityY + 2.5);
  }

  doc.setTextColor(123, 123, 123);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.4);
  doc.text(STAFF_ID_SUBTEXT, topIdentityX, topIdentityY + 6.2);

  doc.setTextColor(95, 95, 95);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);
  doc.text(`ID: ${row.code}`, topIdentityX, identityDividerY - 3.9);

  const photoW = 34;
  const photoH = 60;
  const photoX = x + cardWidth - photoW;
  const photoY = y + cardHeight - photoH;

  if (employeePhoto) {
    doc.addImage(employeePhoto.dataUrl, employeePhoto.format, photoX, photoY, photoW, photoH);
  } else {
    doc.setTextColor(170, 170, 170);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.7);
    doc.text("PHOTO", photoX + photoW / 2, photoY + photoH / 2, { align: "center", baseline: "middle" });
  }

  const textX = topIdentityX;
  const nameMaxWidth = x + cardWidth - textX - 1.1;
  const detailMaxWidth = photoX - textX - 1.2;
  const nameTopY = identityDividerY + 3.85;

  const name = cleanText(row.fullName) || "Employee Name";
  const nameFit = fitTextToBox(doc, {
    text: name.toUpperCase(),
    maxWidth: nameMaxWidth,
    maxLines: 3,
    startFontSize: 8.25,
    minFontSize: 6.2,
  });
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameFit.fontSize);
  if (nameFit.lines.length > 0) {
    doc.text(nameFit.lines.map((line) => line.replace(/\s+/g, " ").replace(/\s/g, "\u2009")), textX + 0.35, nameTopY + 0.35);
  }

  let detailY = nameTopY + Math.max(1, nameFit.lines.length) * 3.45 + 0.9;
  const position = cleanText(row.position);
  if (position) {
    const positionFit = fitTextToBox(doc, {
      text: position,
      maxWidth: detailMaxWidth,
      maxLines: 2,
      startFontSize: 5.3,
      minFontSize: 4.5,
    });
    doc.setTextColor(88, 88, 88);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(positionFit.fontSize);
    if (positionFit.lines.length > 0) {
      doc.text(positionFit.lines, textX + 0.3, detailY + 0.3);
      detailY += positionFit.lines.length * 2.9 + 1;
    }
  }

  const branchFit = fitTextToBox(doc, {
    text: cleanText(row.branchName) || "Main Branch",
    maxWidth: detailMaxWidth,
    maxLines: 2,
    startFontSize: 4.8,
    minFontSize: 4,
  });
  doc.setTextColor(126, 126, 126);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(branchFit.fontSize);
  if (branchFit.lines.length > 0) {
    doc.text(branchFit.lines, textX + 0.3, detailY + 0.3);
  }
}

function drawFrontCard(
  doc: jsPDF,
  row: EmployeeIdCardRow,
  houseLogo: HouseLogo | null,
  employeePhoto: EmployeePhoto | null,
  x: number,
  y: number,
  layout: EmployeeIdCardLayout,
) {
  if (layout === "modern") {
    drawFrontModern(doc, row, houseLogo, employeePhoto, x, y);
    return;
  }

  drawFrontClassic(doc, row, houseLogo, employeePhoto, x, y);
}

function drawBackCard(doc: jsPDF, row: EmployeeIdCardRow, qrDataUrl: string, x: number, y: number) {
  const cardWidth = CR80_SHORT_EDGE_MM;
  const cardHeight = CR80_LONG_EDGE_MM;

  doc.setDrawColor(70);
  doc.setLineWidth(0.2);
  doc.rect(x, y, cardWidth, cardHeight);

  const qrSize = 33;
  const qrPlatePadding = 1.4;
  const qrX = x + (cardWidth - qrSize) / 2;
  const qrY = y + 14;
  doc.setFillColor(...QR_PLATE_BG);
  doc.setDrawColor(182);
  doc.setLineWidth(0.18);
  doc.roundedRect(qrX - qrPlatePadding, qrY - qrPlatePadding, qrSize + qrPlatePadding * 2, qrSize + qrPlatePadding * 2, 1.2, 1.2, "FD");
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.text(getQrCaption(), x + cardWidth / 2, qrY + qrSize + 5.1, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text(row.code, x + cardWidth / 2, qrY + qrSize + 9.2, { align: "center" });

  const footerName = getHeaderBrandName(row.houseBrandName, row.houseName);
  if (footerName) {
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.5);
    doc.text(footerName, x + cardWidth / 2, y + cardHeight - SAFE_MARGIN_MM, { align: "center" });
  }
}

export async function generateEmployeeIdCardPdf(
  row: EmployeeIdCardRow,
  options: { frontLayout?: EmployeeIdCardLayout } = {},
): Promise<Uint8Array> {
  const token = createEmployeeQrToken({ employeeId: row.id, houseId: row.houseId });
  const qrDataUrl = await generateQrPngDataUrl(token);

  const doc = new jsPDF({ unit: "mm", format: [CR80_SHORT_EDGE_MM, CR80_LONG_EDGE_MM], orientation: "portrait" });
  const houseLogo = await resolveHouseLogo(row.houseLogoUrl, new Map());
  const employeePhoto = await resolveEmployeePhoto(row.photoUrl, new Map());

  drawFrontCard(doc, row, houseLogo, employeePhoto, 0, 0, options.frontLayout ?? DEFAULT_FRONT_LAYOUT);
  doc.addPage([CR80_SHORT_EDGE_MM, CR80_LONG_EDGE_MM], "portrait");
  drawBackCard(doc, row, qrDataUrl, 0, 0);

  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buffer);
}

function drawCutGuides(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(190);
  doc.setLineWidth(0.1);
  doc.line(x - 2, y, x, y);
  doc.line(x, y - 2, x, y);
  doc.line(x + CR80_SHORT_EDGE_MM, y - 2, x + CR80_SHORT_EDGE_MM, y);
  doc.line(x + CR80_SHORT_EDGE_MM, y, x + CR80_SHORT_EDGE_MM + 2, y);
  doc.line(x - 2, y + CR80_LONG_EDGE_MM, x, y + CR80_LONG_EDGE_MM);
  doc.line(x, y + CR80_LONG_EDGE_MM, x, y + CR80_LONG_EDGE_MM + 2);
  doc.line(x + CR80_SHORT_EDGE_MM, y + CR80_LONG_EDGE_MM, x + CR80_SHORT_EDGE_MM + 2, y + CR80_LONG_EDGE_MM);
  doc.line(x + CR80_SHORT_EDGE_MM, y + CR80_LONG_EDGE_MM, x + CR80_SHORT_EDGE_MM, y + CR80_LONG_EDGE_MM + 2);
}

export async function generateEmployeeIdCardsSheetPdf(
  rows: EmployeeIdCardRow[],
  options: { layout?: "a4_9up" | "a4_8up"; includeCutGuides?: boolean; frontLayout?: EmployeeIdCardLayout } = {},
): Promise<Uint8Array> {
  const sortedRows = orderEmployeeIdCards(rows);
  const layout = options.layout ?? "a4_8up";
  const includeCutGuides = options.includeCutGuides ?? true;
  const frontLayout = options.frontLayout ?? DEFAULT_FRONT_LAYOUT;

  const cols = layout === "a4_9up" ? 3 : 4;
  const rowsPerPage = layout === "a4_9up" ? 3 : 2;
  const pageWidth = layout === "a4_9up" ? 210 : 297;
  const pageHeight = layout === "a4_9up" ? 297 : 210;
  const pageOrientation = layout === "a4_9up" ? "portrait" : "landscape";
  const horizontalGap = 6;
  const verticalGap = 4;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: pageOrientation });

  const totalWidth = cols * CR80_SHORT_EDGE_MM + (cols - 1) * horizontalGap;
  const totalHeight = rowsPerPage * CR80_LONG_EDGE_MM + (rowsPerPage - 1) * verticalGap;
  const startX = (pageWidth - totalWidth) / 2;
  const startY = (pageHeight - totalHeight) / 2;
  const cardsPerPage = cols * rowsPerPage;

  const logoCache = new Map<string, HouseLogo | null>();
  const photoCache = new Map<string, EmployeePhoto | null>();
  const [qrDataUrls, houseLogos, employeePhotos] = await Promise.all([
    mapWithConcurrency(sortedRows, QR_CONCURRENCY, async (row) => {
      const token = createEmployeeQrToken({ employeeId: row.id, houseId: row.houseId });
      return generateQrPngDataUrl(token);
    }),
    mapWithConcurrency(sortedRows, QR_CONCURRENCY, async (row) => resolveHouseLogo(row.houseLogoUrl, logoCache)),
    mapWithConcurrency(sortedRows, QR_CONCURRENCY, async (row) => resolveEmployeePhoto(row.photoUrl, photoCache)),
  ]);

  const sheetCount = Math.max(1, Math.ceil(sortedRows.length / cardsPerPage));

  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    const sheetStart = sheetIndex * cardsPerPage;
    const sheetEnd = Math.min(sheetStart + cardsPerPage, sortedRows.length);

    if (sheetIndex > 0) {
      doc.addPage();
    }

    for (let index = sheetStart; index < sheetEnd; index += 1) {
      const slot = index - sheetStart;
      const rowSlot = Math.floor(slot / cols);
      const colSlot = slot % cols;
      const x = startX + colSlot * (CR80_SHORT_EDGE_MM + horizontalGap);
      const y = startY + rowSlot * (CR80_LONG_EDGE_MM + verticalGap);

      drawFrontCard(doc, sortedRows[index], houseLogos[index], employeePhotos[index], x, y, frontLayout);
      if (includeCutGuides) {
        drawCutGuides(doc, x, y);
      }
    }

    doc.addPage();
    for (let index = sheetStart; index < sheetEnd; index += 1) {
      const slot = index - sheetStart;
      const rowSlot = Math.floor(slot / cols);
      const colSlot = slot % cols;
      const x = startX + colSlot * (CR80_SHORT_EDGE_MM + horizontalGap);
      const y = startY + rowSlot * (CR80_LONG_EDGE_MM + verticalGap);

      drawBackCard(doc, sortedRows[index], qrDataUrls[index], x, y);
      if (includeCutGuides) {
        drawCutGuides(doc, x, y);
      }
    }
  }

  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buffer);
}
