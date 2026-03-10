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
const HEADER_HEIGHT_MM = 7.6;
const HEADER_BG = [55, 65, 81] as const;
const HEADER_ACCENT_LEFT = [109, 185, 245] as const;
const HEADER_ACCENT_RIGHT = [88, 116, 168] as const;
const HEADER_ACCENT_LEFT = [109, 185, 245] as const;
const HEADER_ACCENT_RIGHT = [88, 116, 168] as const;
const DEFAULT_QR_CAPTION = "Scan at kiosk";
const STAFF_ID_SUBTEXT = "STAFF ID";
const PHOTO_VERTICAL_FOCUS = 0.43;

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

  const accentY = y + HEADER_HEIGHT_MM - 0.7;
  const accentWidth = CR80_WIDTH_MM / 2;
  doc.setFillColor(...HEADER_ACCENT_LEFT);
  doc.rect(x, accentY, accentWidth, 0.7, "F");
  doc.setFillColor(...HEADER_ACCENT_RIGHT);
  doc.rect(x + accentWidth, accentY, accentWidth, 0.7, "F");

  const headerTextY = y + 3.55;
  const headerSubtextY = y + 5.75;
    const logoSize = 4.8;
    doc.setFontSize(7.8);
    doc.setFontSize(4.5);
    doc.setFontSize(8.2);
    doc.setFontSize(4.5);
    doc.setFontSize(6.6);
  const photoW = 19.4;
  const photoH = 29.4;
  const photoPlatePad = 1.2;
  const photoInnerX = photoX + photoPlatePad;
  const photoInnerY = photoY + photoPlatePad;
  const photoInnerW = photoW - photoPlatePad * 2;
  const photoInnerH = photoH - photoPlatePad * 2;
  const photoCornerRadius = 0.7;
  const imageFrameX = photoInnerX;
  const imageFrameY = photoInnerY;
  const imageFrameW = photoInnerW;
  const imageFrameH = photoInnerH;

  doc.setFillColor(242, 244, 247);
  doc.setDrawColor(184, 189, 196);
  doc.setLineWidth(0.2);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1.1, 1.1, "FD");

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(207, 212, 219);
  doc.setLineWidth(0.12);
  doc.roundedRect(imageFrameX, imageFrameY, imageFrameW, imageFrameH, photoCornerRadius, photoCornerRadius, "FD");
    doc.addImage(
      employeePhoto.dataUrl,
      employeePhoto.format,
      imageFrameX,
      imageFrameY,
      imageFrameW,
      imageFrameH,
    );

    doc.setDrawColor(207, 212, 219);
    doc.setLineWidth(0.12);
    doc.roundedRect(
      imageFrameX,
      imageFrameY,
      imageFrameW,
      imageFrameH,
      photoCornerRadius,
      photoCornerRadius,
      "S",
    );
    doc.text("PHOTO", photoInnerX + photoInnerW / 2, photoInnerY + photoInnerH / 2, {
      align: "center",
      baseline: "middle",
    });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.2);
  doc.text("ID", photoX, photoY + photoH + 3.4);
  doc.setFontSize(8);
  doc.text(row.code, photoX + 4.3, photoY + photoH + 3.4);
  const centerX = photoX + photoW + 3.8;
  const centerW = 32;
    startFontSize: 10.8,
  const nameLineHeight = 3.7;
  const nameTopY = y + HEADER_HEIGHT_MM + 5.1;
  let infoY = nameTopY + nameBlockHeight + 0.9;
      startFontSize: 8,
      minFontSize: 6.8,
      infoY += 3.4;
  doc.setFontSize(6.7);
  doc.text(cleanText(row.branchName) || "Main Branch", centerX, infoY);
  infoY += 3.2;
    doc.setFontSize(6.1);
  const qrSize = 18.5;
  const qrPad = 0.9;
  const qrPlateW = qrSize + qrPad * 2;
  const qrPlateH = qrSize + qrPad * 2 + 3;
  const qrPlateX = x + CR80_WIDTH_MM - SAFE_MARGIN_MM - qrPlateW;
  const qrPlateY = y + HEADER_HEIGHT_MM + 2;
  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(203, 208, 216);
  doc.setLineWidth(0.14);
  doc.roundedRect(qrPlateX, qrPlateY, qrPlateW, qrPlateH, 0.9, 0.9, "FD");

  const qrX = qrPlateX + qrPad;
  const qrY = qrPlateY + qrPad;
  doc.setTextColor(68, 76, 89);
  doc.setFontSize(4.5);
  doc.text(getQrCaption(), qrPlateX + qrPlateW / 2, qrPlateY + qrPlateH - 0.9, { align: "center" });
  const signatureY = y + CR80_HEIGHT_MM - SAFE_MARGIN_MM - 2.2;
  const sigW = 30;
  doc.setTextColor(78, 86, 99);
  doc.setFontSize(5.1);
  doc.text("Authorized Signature", sigX, signatureY - 1.1);
  doc.setDrawColor(120, 129, 143);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");

  if (houseLogo && hasHeaderName) {
    const logoSize = 4.8;
    const logoX = x + SAFE_MARGIN_MM;
    const logoY = y + (HEADER_HEIGHT_MM - logoSize) / 2;
    doc.addImage(houseLogo.dataUrl, houseLogo.format, logoX, logoY, logoSize, logoSize);

    doc.setFontSize(7.8);
    doc.text(headerName, logoX + logoSize + 1.8, headerTextY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.5);
    doc.text(STAFF_ID_SUBTEXT, logoX + logoSize + 1.8, headerSubtextY);
  } else if (hasHeaderName) {
    doc.setFontSize(8.2);
    doc.text(headerName, x + CR80_WIDTH_MM / 2, headerTextY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.5);
    doc.text(STAFF_ID_SUBTEXT, x + CR80_WIDTH_MM / 2, headerSubtextY, { align: "center" });
  } else {
    doc.setFontSize(6.6);
    doc.text(STAFF_ID_SUBTEXT, x + CR80_WIDTH_MM / 2, y + HEADER_HEIGHT_MM / 2 + 0.8, {
      align: "center",
      baseline: "middle",
    });
  }

  doc.setTextColor(0, 0, 0);

  const photoX = x + SAFE_MARGIN_MM;
  const photoY = y + HEADER_HEIGHT_MM + 2;
  const photoW = 19.4;
  const photoH = 29.4;
  const photoPlatePad = 1.2;
  const photoInnerX = photoX + photoPlatePad;
  const photoInnerY = photoY + photoPlatePad;
  const photoInnerW = photoW - photoPlatePad * 2;
  const photoInnerH = photoH - photoPlatePad * 2;
  const photoCornerRadius = 0.7;
  const imageFrameX = photoInnerX;
  const imageFrameY = photoInnerY;
  const imageFrameW = photoInnerW;
  const imageFrameH = photoInnerH;

  doc.setFillColor(242, 244, 247);
  doc.setDrawColor(184, 189, 196);
  doc.setLineWidth(0.2);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1.1, 1.1, "FD");

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(207, 212, 219);
  doc.setLineWidth(0.12);
  doc.roundedRect(imageFrameX, imageFrameY, imageFrameW, imageFrameH, photoCornerRadius, photoCornerRadius, "FD");

  if (employeePhoto) {
    const imageProps = doc.getImageProperties(employeePhoto.dataUrl);
    const imageAspect = imageProps.width / imageProps.height;
    const frameAspect = imageFrameW / imageFrameH;

    let drawW = imageFrameW;
    let drawH = imageFrameH;
    let drawX = imageFrameX;
    let drawY = imageFrameY;

    if (imageAspect > frameAspect) {
      drawW = imageFrameH * imageAspect;
      drawX = imageFrameX - (drawW - imageFrameW) / 2;
    } else {
      drawH = imageFrameW / imageAspect;
      drawY = imageFrameY - (drawH - imageFrameH) * PHOTO_VERTICAL_FOCUS;
    }

    doc.saveGraphicsState();
    doc.rect(imageFrameX, imageFrameY, imageFrameW, imageFrameH, "n");
    doc.clip();
    doc.addImage(employeePhoto.dataUrl, employeePhoto.format, drawX, drawY, drawW, drawH);
    doc.restoreGraphicsState();

    doc.setDrawColor(207, 212, 219);
    doc.setLineWidth(0.12);
    doc.roundedRect(imageFrameX, imageFrameY, imageFrameW, imageFrameH, photoCornerRadius, photoCornerRadius, "S");
  } else {
    doc.setTextColor(175, 175, 175);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.text("PHOTO", photoInnerX + photoInnerW / 2, photoInnerY + photoInnerH / 2, { align: "center", baseline: "middle" });
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.2);
  doc.text("ID", photoX, photoY + photoH + 3.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(row.code, photoX + 4.3, photoY + photoH + 3.4);

  const centerX = photoX + photoW + 3.8;
  const centerW = 32;
  const name = cleanText(row.fullName) || "Employee Name";

  const nameFit = fitTextToBox(doc, {
    text: name,
    maxWidth: centerW,
    maxLines: 2,
    startFontSize: 10.8,
    minFontSize: 8,
  });
  const nameLineHeight = 3.7;
  const nameTopY = y + HEADER_HEIGHT_MM + 5.1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameFit.fontSize);
  if (nameFit.lines.length > 0) {
    doc.text(nameFit.lines, centerX, nameTopY);
  }

  const nameBlockHeight = nameLineHeight * 2;
  let infoY = nameTopY + nameBlockHeight + 0.9;

  const position = cleanText(row.position);
  if (position) {
    const positionFit = fitTextToBox(doc, {
      text: position,
      maxWidth: centerW,
      maxLines: 1,
      startFontSize: 8,
      minFontSize: 6.8,
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(positionFit.fontSize);
    if (positionFit.lines.length > 0) {
      doc.text(positionFit.lines[0], centerX, infoY);
      infoY += 3.4;
    }
  }

  doc.setFontSize(6.7);
  doc.text(cleanText(row.branchName) || "Main Branch", centerX, infoY);
  infoY += 3.2;

  const validUntilLabel = formatValidUntil(row.validUntil);
  if (validUntilLabel) {
    doc.setFontSize(6.1);
    doc.text(validUntilLabel, centerX, infoY);
  }

  const qrSize = 18.5;
  const qrPad = 0.9;
  const qrPlateW = qrSize + qrPad * 2;
  const qrPlateH = qrSize + qrPad * 2 + 3;
  const qrPlateX = x + CR80_WIDTH_MM - SAFE_MARGIN_MM - qrPlateW;
  const qrPlateY = y + HEADER_HEIGHT_MM + 2;
  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(203, 208, 216);
  doc.setLineWidth(0.14);
  doc.roundedRect(qrPlateX, qrPlateY, qrPlateW, qrPlateH, 0.9, 0.9, "FD");

  const qrX = qrPlateX + qrPad;
  const qrY = qrPlateY + qrPad;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(68, 76, 89);
  doc.setFontSize(4.5);
  doc.text(getQrCaption(), qrPlateX + qrPlateW / 2, qrPlateY + qrPlateH - 0.9, { align: "center" });

  const signatureY = y + CR80_HEIGHT_MM - SAFE_MARGIN_MM - 2.2;
  const sigX = x + SAFE_MARGIN_MM;
  const sigW = 30;
  doc.setTextColor(78, 86, 99);
  doc.setFontSize(5.1);
  doc.text("Authorized Signature", sigX, signatureY - 1.1);
  doc.setDrawColor(120, 129, 143);
  doc.setLineWidth(0.15);
  doc.line(sigX, signatureY, sigX + sigW, signatureY);
}

export async function generateEmployeeIdCardPdf(row: EmployeeIdCardRow): Promise<Uint8Array> {
  const token = createEmployeeQrToken({ employeeId: row.id, houseId: row.houseId });
  const qrDataUrl = await generateQrPngDataUrl(token);

  const doc = new jsPDF({ unit: "mm", format: [CR80_HEIGHT_MM, CR80_WIDTH_MM], orientation: "landscape" });
  const houseLogo = await resolveHouseLogo(row.houseLogoUrl, new Map());
  const employeePhoto = await resolveEmployeePhoto(row.photoUrl, new Map());
  drawCard(doc, row, qrDataUrl, houseLogo, employeePhoto, 0, 0);

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
  const photoCache = new Map<string, EmployeePhoto | null>();
  const [qrDataUrls, houseLogos, employeePhotos] = await Promise.all([
    mapWithConcurrency(sortedRows, QR_CONCURRENCY, async (row) => {
      const token = createEmployeeQrToken({ employeeId: row.id, houseId: row.houseId });
      return generateQrPngDataUrl(token);
    }),
    mapWithConcurrency(sortedRows, QR_CONCURRENCY, async (row) => resolveHouseLogo(row.houseLogoUrl, logoCache)),
    mapWithConcurrency(sortedRows, QR_CONCURRENCY, async (row) => resolveEmployeePhoto(row.photoUrl, photoCache)),
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
    drawCard(doc, row, qrDataUrls[index], houseLogos[index], employeePhotos[index], x, y);

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
