# Student ID Card Generator — Application Guide

A local-first browser application for importing a school's Excel register, maintaining the fields needed on student identity cards, capturing or uploading photographs, and exporting print-ready A4 PDFs.

## Quick Start

1. Open a terminal in this `student-id-card-system` directory.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local address printed by Vite (normally `http://localhost:5173`).

For camera use, run on `localhost` or deploy behind HTTPS. The app does not need a backend or account.

## Import the supplied workbook

Use **Import Excel** and select `Student detail Zone jib format 2026.xlsx`.

The importer locates the heading row by the `Name of Student` and `Parentage` headings, rather than assuming the headings are in the first row. It maps:
- `Name of Student`
- `Parentage`
- `Class name`
- `Date of Birth (DD/MM/YYYY)`
- `Mobile no of the student`
- `Admission Number` (internal identifier only; not printed)

Other spreadsheet columns are not imported into the app's student records.

If the school uses a different workbook later, its first worksheet should contain equivalent column headings.

## Photograph workflow

1. Open **Photographs**.
2. Select a student.
3. Choose **Open camera** or **Upload photograph**.
4. Captured/uploaded images are resized and saved in this browser's IndexedDB.
5. Repeat for the remaining students. Progress persists when the browser is closed.

Camera permission requires the user to allow camera access. If camera access is unavailable, use the upload option.

## Generate and print

1. Set the **Year of issue** field in the header.
2. Open **Generate & print**.
3. Generate all cards, the currently filtered list, or one selected student.
4. Open the downloaded PDF.
5. In the print dialog choose:
   - Paper: A4
   - Orientation: Landscape
   - Scale: Actual size / 100%
   - Disable Fit to page / Shrink to fit
6. Print one test sheet and measure one card before printing the full batch.

The PDF page is exactly 297 × 210 mm and every card is exactly 110 × 90 mm. Four cards are centered on each sheet. For 92 records, the expected output is 23 sheets.

## Data storage and privacy

- Student details and photographs are stored locally in the current browser profile using IndexedDB.
- No server, cloud upload, analytics or external database is used.
- Clearing browser site data can delete the stored records. Keep the original workbook and secure backups.
- Use only on a school-authorized device. Restrict device/browser access and follow applicable school and parental authorization requirements for handling children's personal information and photographs.

## Notes / limitations

- The PDF embeds photographs and uses standard Helvetica fonts. Check names and dates in the preview table before printing.
- Date values are normalized from Excel dates or text. If a date is entered in an unusual text format, edit that student's record before printing.
- The app is designed for the supplied workbook's first worksheet.
- This is a browser-based local utility, not a certified student information management system.
