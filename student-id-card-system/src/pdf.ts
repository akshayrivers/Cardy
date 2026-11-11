import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CardSettings, Student } from "./types";
import { computePageLayout, MM_TO_PT } from "./layout";

function safe(value: string): string {
  return value || "—";
}

function drawTextFit(
  page: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: any,
  startSize: number,
  color: any,
  minSize = 6
) {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.4;
  }
  page.drawText(text, { x, y, size, font, color, maxWidth });
}

async function loadImage(pdf: PDFDocument, dataUrl: string) {
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  return dataUrl.startsWith("data:image/png")
    ? pdf.embedPng(bytes)
    : pdf.embedJpg(bytes);
}

async function drawCard(
  pdf: PDFDocument,
  page: any,
  student: Student,
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  settings: CardSettings,
  issueYear: string
) {
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.07, 0.22, 0.36);
  const blue = rgb(0.1, 0.34, 0.53);
  const ink = rgb(0.12, 0.16, 0.2);
  const muted = rgb(0.35, 0.4, 0.45);
  const white = rgb(1, 1, 1);

  // Card Outer Border
  page.drawRectangle({
    x,
    y,
    width: cardW,
    height: cardH,
    color: white,
    borderColor: navy,
    borderWidth: 1.1,
  });

  // Dynamic Header Dimensions
  const headerH = Math.max(13 * MM_TO_PT, Math.min(22 * MM_TO_PT, cardH * 0.22));
  page.drawRectangle({
    x,
    y: y + cardH - headerH,
    width: cardW,
    height: headerH,
    color: navy,
  });

  // Dynamic Institution Header Text
  const instName = (settings.institutionName || "MODEL PUBLIC SCHOOL").toUpperCase();
  const subHead = (settings.subHeader || "DEPARTMENT OF EDUCATION").toUpperCase();

  const headerPadX = 3.8 * MM_TO_PT;
  const maxHeaderW = cardW - 2 * headerPadX;

  drawTextFit(
    page,
    instName,
    x + headerPadX,
    y + cardH - headerH * 0.48,
    maxHeaderW,
    bold,
    9.2,
    white,
    6.5
  );

  drawTextFit(
    page,
    subHead,
    x + headerPadX,
    y + cardH - headerH * 0.82,
    maxHeaderW,
    regular,
    7.4,
    rgb(0.88, 0.93, 0.97),
    5.5
  );

  // Dynamic Footer Dimensions
  const footerH = Math.max(8.5 * MM_TO_PT, Math.min(13 * MM_TO_PT, cardH * 0.15));
  page.drawLine({
    start: { x: x + 3.5 * MM_TO_PT, y: y + footerH },
    end: { x: x + cardW - 3.5 * MM_TO_PT, y: y + footerH },
    thickness: 0.55,
    color: rgb(0.82, 0.86, 0.89),
  });

  const yearText = `YEAR OF ISSUE: ${issueYear || "—"}`;
  page.drawText(yearText, {
    x: x + 4 * MM_TO_PT,
    y: y + footerH * 0.32,
    size: 7.0,
    font: bold,
    color: navy,
  });

  const cardTitle = (settings.cardTitle || "STUDENT IDENTITY CARD").toUpperCase();
  const titleSize = 6.8;
  const titleW = bold.widthOfTextAtSize(cardTitle, titleSize);
  const titleX = Math.max(x + cardW / 2, x + cardW - titleW - 4 * MM_TO_PT);

  drawTextFit(
    page,
    cardTitle,
    titleX,
    y + footerH * 0.32,
    cardW - (titleX - x) - 3.5 * MM_TO_PT,
    bold,
    titleSize,
    navy,
    5.5
  );

  // Body content area between header and footer
  const bodyY = y + footerH;
  const bodyH = cardH - headerH - footerH;

  // Photo box (right-aligned)
  const photoW = Math.max(18 * MM_TO_PT, Math.min(30 * MM_TO_PT, cardW * 0.24));
  const photoH = Math.max(24 * MM_TO_PT, Math.min(42 * MM_TO_PT, bodyH * 0.84));
  const photoX = x + cardW - photoW - 3.8 * MM_TO_PT;
  const photoY = bodyY + (bodyH - photoH) / 2;

  page.drawRectangle({
    x: photoX,
    y: photoY,
    width: photoW,
    height: photoH,
    color: rgb(0.94, 0.96, 0.97),
    borderColor: blue,
    borderWidth: 0.75,
  });

  if (student.photo) {
    try {
      const image = await loadImage(pdf, student.photo);
      const iw = image.width;
      const ih = image.height;
      const scale = Math.max(photoW / iw, photoH / ih);
      const w = iw * scale;
      const h = ih * scale;
      page.drawImage(image, {
        x: photoX + (photoW - w) / 2,
        y: photoY + (photoH - h) / 2,
        width: w,
        height: h,
      });
    } catch {
      page.drawText("PHOTO", {
        x: photoX + (photoW - 24) / 2,
        y: photoY + photoH / 2 - 3,
        size: 7.5,
        font: bold,
        color: muted,
      });
    }
  } else {
    page.drawText("PHOTO", {
      x: photoX + (photoW - 24) / 2,
      y: photoY + photoH / 2 - 3,
      size: 7.5,
      font: bold,
      color: muted,
    });
  }

  // Student Details
  const left = x + 4 * MM_TO_PT;
  const labelW = Math.min(22 * MM_TO_PT, cardW * 0.22);
  const valueX = left + labelW;
  const valueW = photoX - valueX - 2.5 * MM_TO_PT;

  const rows: [string, string][] = [
    ["NAME", safe(student.name)],
    ["PARENTAGE", safe(student.parentage)],
    ["CLASS", safe(student.className)],
    ["DATE OF BIRTH", safe(student.dob)],
    ["MOBILE", safe(student.mobile)],
  ];

  const rowStep = (bodyH - 2.5 * MM_TO_PT) / 5;
  let rowY = bodyY + bodyH - rowStep * 0.85;

  for (const [label, value] of rows) {
    page.drawText(label, {
      x: left,
      y: rowY,
      size: 6.2,
      font: bold,
      color: muted,
    });
    drawTextFit(page, value, valueX, rowY - 0.2, valueW, bold, 7.8, ink, 5.8);
    rowY -= rowStep;
  }
}

export async function generatePdf(
  students: Student[],
  issueYear: string,
  cardSettings: CardSettings
): Promise<Uint8Array> {
  const layout = computePageLayout(cardSettings);
  const pdf = await PDFDocument.create();

  const school = cardSettings.institutionName || "Model Public School";
  const title = cardSettings.cardTitle || "Student Identity Card";
  pdf.setTitle(`${school} — ${title}s`);
  pdf.setSubject(`${cardSettings.subHeader || "Department of Education"} | Year ${issueYear}`);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const guide = rgb(0.48, 0.52, 0.56);
  const cutLen = 3 * MM_TO_PT;

  const totalPages = Math.max(1, Math.ceil(students.length / layout.cardsPerPage));

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdf.addPage([layout.pageWidthPt, layout.pageHeightPt]);
    const batch = students.slice(
      pageIdx * layout.cardsPerPage,
      (pageIdx + 1) * layout.cardsPerPage
    );

    for (let slotIdx = 0; slotIdx < batch.length; slotIdx++) {
      const slot = layout.slots[slotIdx];
      if (!slot) continue;

      await drawCard(
        pdf,
        page,
        batch[slotIdx],
        slot.pdfX,
        slot.pdfY,
        slot.cardWPt,
        slot.cardHPt,
        cardSettings,
        issueYear
      );

      // Draw cut / crop guides at corners of each card
      const cx = slot.pdfX;
      const cy = slot.pdfY;
      const cw = slot.cardWPt;
      const ch = slot.cardHPt;

      const cornerPoints: [number, number, number, number][] = [
        [cx, cy, 1, 1],
        [cx + cw, cy, -1, 1],
        [cx, cy + ch, 1, -1],
        [cx + cw, cy + ch, -1, -1],
      ];

      for (const [sx, sy, dx, dy] of cornerPoints) {
        page.drawLine({
          start: { x: sx, y: sy },
          end: { x: sx + dx * cutLen, y: sy },
          thickness: 0.45,
          color: guide,
        });
        page.drawLine({
          start: { x: sx, y: sy },
          end: { x: sx, y: sy + dy * cutLen },
          thickness: 0.45,
          color: guide,
        });
      }
    }

    // Page margin info line
    page.drawText(
      `${school.toUpperCase()} • PAGE ${pageIdx + 1} OF ${totalPages} • ${batch.length} CARD${
        batch.length === 1 ? "" : "S"
      } ON SHEET (${cardSettings.widthCm} × ${cardSettings.heightCm} CM)`,
      {
        x: 6 * MM_TO_PT,
        y: 3.5 * MM_TO_PT,
        size: 5.5,
        font: regular,
        color: rgb(0.55, 0.58, 0.61),
      }
    );
  }

  return pdf.save();
}
