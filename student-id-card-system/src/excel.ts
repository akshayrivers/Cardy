import * as XLSX from "xlsx";
import type { Student } from "./types";

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("en-GB");
  return String(value).trim();
}

function formatDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
  }
  return cellText(value);
}

function findHeader(headers: string[], candidates: string[]): number {
  return headers.findIndex(h => candidates.some(c => normalize(h).includes(normalize(c))));
}

export async function importWorkbook(file: File): Promise<Student[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  // The supplied school workbook has its actual column headings on row 3.
  const headerRowIndex = rows.findIndex(row =>
    row.some(cell => normalize(cell).includes("name of student")) &&
    row.some(cell => normalize(cell).includes("parentage"))
  );
  if (headerRowIndex < 0) {
    throw new Error("Could not find the header row. The Excel sheet must contain 'Name of Student' and 'Parentage' columns.");
  }
  const headers = (rows[headerRowIndex] as unknown[]).map(cellText);
  const nameCol = findHeader(headers, ["name of student", "student name"]);
  const parentCol = findHeader(headers, ["parentage", "father name"]);
  const classCol = findHeader(headers, ["class name", "class"]);
  const dobCol = findHeader(headers, ["date of birth", "dob"]);
  const mobileCol = findHeader(headers, ["mobile no", "mobile number"]);
  const admissionCol = findHeader(headers, ["admission number", "admission no"]);

  if ([nameCol, parentCol, classCol, dobCol, mobileCol].some(i => i < 0)) {
    throw new Error("One or more required columns are missing: student name, parentage, class, date of birth, mobile number.");
  }

  const seen = new Map<string, number>();
  const students: Student[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const name = cellText(row[nameCol]);
    if (!name) continue;
    const admission = admissionCol >= 0 ? cellText(row[admissionCol]) : "";
    const unique = admission || `${name}-${cellText(row[parentCol])}-${i}`;
    const count = seen.get(unique) ?? 0;
    seen.set(unique, count + 1);
    students.push({
      id: `${unique}-${count}`,
      name,
      parentage: cellText(row[parentCol]),
      className: cellText(row[classCol]),
      dob: formatDate(row[dobCol]),
      mobile: cellText(row[mobileCol]),
      admissionNumber: admission
    });
  }
  if (!students.length) throw new Error("No student records were found in the workbook.");
  return students;
}