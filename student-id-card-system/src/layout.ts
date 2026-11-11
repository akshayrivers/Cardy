import type { CardSettings, Student } from "./types";

export const MM_TO_PT = 72 / 25.4;

export const A4_WIDTH_MM = 297;
export const A4_HEIGHT_MM = 210;

export interface CardSlot {
  slotIndex: number;
  col: number;
  row: number;
  xMm: number;        // From top-left in mm (for preview / CSS)
  yMm: number;        // From top-left in mm (for preview / CSS)
  pdfX: number;       // In PDF points from bottom-left
  pdfY: number;       // In PDF points from bottom-left
  cardWPt: number;    // Width in PDF points
  cardHPt: number;    // Height in PDF points
}

export interface PageLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  pageWidthPt: number;
  pageHeightPt: number;
  cardWidthMm: number;
  cardHeightMm: number;
  cardWidthPt: number;
  cardHeightPt: number;
  gapMm: number;
  gapPt: number;
  columns: number;
  rows: number;
  cardsPerPage: number;
  marginLeftMm: number;
  marginTopMm: number;
  isLandscape: boolean;
  slots: CardSlot[];
}

export interface CardPreset {
  id: string;
  label: string;
  widthCm: number;
  heightCm: number;
  description: string;
}

export const CARD_PRESETS: CardPreset[] = [
  {
    id: "default-104-70",
    label: "10.4 × 7.0 cm (Default)",
    widthCm: 10.4,
    heightCm: 7.0,
    description: "New standard school card size — fits 4 per A4 sheet with comfortable margins"
  },
  {
    id: "previous-110-90",
    label: "11.0 × 9.0 cm (Previous)",
    widthCm: 11.0,
    heightCm: 9.0,
    description: "Original wide card format"
  },
  {
    id: "cr80-86-54",
    label: "8.6 × 5.4 cm (CR80 Standard)",
    widthCm: 8.6,
    heightCm: 5.4,
    description: "Standard credit card / plastic pouch ID size"
  },
  {
    id: "pocket-90-60",
    label: "9.0 × 6.0 cm (Compact)",
    widthCm: 9.0,
    heightCm: 6.0,
    description: "Compact ID badge size"
  }
];

export function computePageLayout(settings: CardSettings): PageLayout {
  const cardWMm = Math.max(20, Math.min(250, Number(settings.widthCm || 10.4) * 10));
  const cardHMm = Math.max(20, Math.min(250, Number(settings.heightCm || 7.0) * 10));
  const gapMm = Math.max(0, Math.min(20, Number(settings.gapMm ?? 4)));

  const minMarginMm = 6; // Safe printable boundary on standard printers

  // Determine orientation
  let isLandscape = true;
  if (settings.orientation === "portrait") {
    isLandscape = false;
  } else if (settings.orientation === "landscape") {
    isLandscape = true;
  } else {
    // "auto": determine which orientation yields more cards per page
    const landCols = Math.max(1, Math.floor((A4_WIDTH_MM - 2 * minMarginMm + gapMm) / (cardWMm + gapMm)));
    const landRows = Math.max(1, Math.floor((A4_HEIGHT_MM - 2 * minMarginMm + gapMm) / (cardHMm + gapMm)));
    const landCap = landCols * landRows;

    const portCols = Math.max(1, Math.floor((A4_HEIGHT_MM - 2 * minMarginMm + gapMm) / (cardWMm + gapMm)));
    const portRows = Math.max(1, Math.floor((A4_WIDTH_MM - 2 * minMarginMm + gapMm) / (cardHMm + gapMm)));
    const portCap = portCols * portRows;

    isLandscape = landCap >= portCap;
  }

  const pageWidthMm = isLandscape ? A4_WIDTH_MM : A4_HEIGHT_MM;
  const pageHeightMm = isLandscape ? A4_HEIGHT_MM : A4_WIDTH_MM;

  // Calculate maximum columns and rows that fit within printable bounds
  const columns = Math.max(1, Math.floor((pageWidthMm - 2 * minMarginMm + gapMm) / (cardWMm + gapMm)));
  const rows = Math.max(1, Math.floor((pageHeightMm - 2 * minMarginMm + gapMm) / (cardHMm + gapMm)));
  const cardsPerPage = columns * rows;

  const totalGridWMm = columns * cardWMm + (columns - 1) * gapMm;
  const totalGridHMm = rows * cardHMm + (rows - 1) * gapMm;

  // Center on page
  const marginLeftMm = Math.max(0, (pageWidthMm - totalGridWMm) / 2);
  const marginTopMm = Math.max(0, (pageHeightMm - totalGridHMm) / 2);

  const pageWidthPt = pageWidthMm * MM_TO_PT;
  const pageHeightPt = pageHeightMm * MM_TO_PT;
  const cardWPt = cardWMm * MM_TO_PT;
  const cardHPt = cardHMm * MM_TO_PT;
  const gapPt = gapMm * MM_TO_PT;

  const slots: CardSlot[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const slotIndex = r * columns + c;
      const xMm = marginLeftMm + c * (cardWMm + gapMm);
      const yMm = marginTopMm + r * (cardHMm + gapMm);

      // In PDF, origin is bottom-left
      const pdfX = xMm * MM_TO_PT;
      const pdfY = (pageHeightMm - (yMm + cardHMm)) * MM_TO_PT;

      slots.push({
        slotIndex,
        col: c,
        row: r,
        xMm,
        yMm,
        pdfX,
        pdfY,
        cardWPt,
        cardHPt,
      });
    }
  }

  return {
    pageWidthMm,
    pageHeightMm,
    pageWidthPt,
    pageHeightPt,
    cardWidthMm: cardWMm,
    cardHeightMm: cardHMm,
    cardWidthPt: cardWPt,
    cardHeightPt: cardHPt,
    gapMm,
    gapPt,
    columns,
    rows,
    cardsPerPage,
    marginLeftMm,
    marginTopMm,
    isLandscape,
    slots,
  };
}

export function paginateStudents(students: Student[], cardsPerPage: number): Student[][] {
  if (!students.length) return [[]];
  const pages: Student[][] = [];
  for (let i = 0; i < students.length; i += cardsPerPage) {
    pages.push(students.slice(i, i + cardsPerPage));
  }
  return pages;
}
