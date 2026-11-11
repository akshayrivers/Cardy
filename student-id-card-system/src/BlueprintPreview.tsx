import React, { useState } from "react";
import type { CardSettings, Student } from "./types";
import { computePageLayout } from "./layout";

interface BlueprintPreviewProps {
  students: Student[];
  settings: CardSettings;
  issueYear: string;
}

export const BlueprintPreview: React.FC<BlueprintPreviewProps> = ({
  students,
  settings,
  issueYear,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<"blueprint" | "print">("blueprint");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const layout = computePageLayout(settings);
  const totalPages = Math.max(1, Math.ceil(students.length / layout.cardsPerPage));

  // Keep page in valid bounds if students count or layout changes
  const activePage = Math.min(currentPage, totalPages - 1);

  const pageStartIndex = activePage * layout.cardsPerPage;
  const currentBatch = students.slice(pageStartIndex, pageStartIndex + layout.cardsPerPage);
  const cardsOnCurrentPage = currentBatch.length;

  const aspectRatio = `${layout.pageWidthMm} / ${layout.pageHeightMm}`;

  return (
    <div className="blueprint-container">
      {/* Blueprint Header / Stats Bar */}
      <div className="blueprint-header">
        <div className="blueprint-title-wrap">
          <div className="blueprint-badge">
            <span className="bp-icon">📐</span>
            <span>A4 IMPOSITION BLUEPRINT</span>
          </div>
          <h3>
            {layout.isLandscape ? "A4 Landscape" : "A4 Portrait"} ({layout.pageWidthMm / 10} × {layout.pageHeightMm / 10} cm)
          </h3>
        </div>

        <div className="blueprint-page-stats">
          <div className="bp-stat-pill highlight">
            <span className="bp-stat-label">Cards on this page</span>
            <strong className="bp-stat-value">
              {cardsOnCurrentPage} <small>/ {layout.cardsPerPage} max</small>
            </strong>
          </div>
          <div className="bp-stat-pill">
            <span className="bp-stat-label">Grid Layout</span>
            <strong className="bp-stat-value">
              {layout.columns} cols × {layout.rows} rows
            </strong>
          </div>
          <div className="bp-stat-pill">
            <span className="bp-stat-label">Card Size</span>
            <strong className="bp-stat-value">
              {settings.widthCm} × {settings.heightCm} cm
            </strong>
          </div>
          <div className="bp-stat-pill">
            <span className="bp-stat-label">Total Sheets</span>
            <strong className="bp-stat-value">
              {totalPages} sheet{totalPages === 1 ? "" : "s"} ({students.length} cards)
            </strong>
          </div>
        </div>
      </div>

      {/* Blueprint Controls: View mode and Sheet pagination */}
      <div className="blueprint-toolbar">
        <div className="view-toggle">
          <button
            type="button"
            className={`toggle-btn ${viewMode === "blueprint" ? "active" : ""}`}
            onClick={() => setViewMode("blueprint")}
          >
            <span className="btn-icon">⚡</span> Blueprint Schematic
          </button>
          <button
            type="button"
            className={`toggle-btn ${viewMode === "print" ? "active" : ""}`}
            onClick={() => setViewMode("print")}
          >
            <span className="btn-icon">🖨️</span> Rendered Print Sheet
          </button>
        </div>

        <div className="blueprint-pager">
          <button
            type="button"
            className="pager-nav-btn"
            disabled={activePage === 0}
            onClick={() => {
              setCurrentPage(p => Math.max(0, p - 1));
              setSelectedSlotIndex(null);
            }}
          >
            ◀ Previous Sheet
          </button>
          <div className="pager-indicator">
            Sheet <b>{activePage + 1}</b> of <b>{totalPages}</b>
          </div>
          <button
            type="button"
            className="pager-nav-btn"
            disabled={activePage >= totalPages - 1}
            onClick={() => {
              setCurrentPage(p => Math.min(totalPages - 1, p + 1));
              setSelectedSlotIndex(null);
            }}
          >
            Next Sheet ▶
          </button>
        </div>
      </div>

      {/* Dimension Indicators & Sheet Wrapper */}
      <div className="sheet-viewport">
        {/* Top Page Width Dimension Ruler */}
        <div className="dimension-bar horizontal-top">
          <div className="dim-line left-line" />
          <span className="dim-text">
            Page Width: {layout.pageWidthMm / 10} cm ({layout.pageWidthMm} mm)
          </span>
          <div className="dim-line right-line" />
        </div>

        <div className="sheet-with-side-dim">
          {/* Left Page Height Dimension Ruler */}
          <div className="dimension-bar vertical-left">
            <div className="dim-line top-line" />
            <span className="dim-text">
              Page Height: {layout.pageHeightMm / 10} cm ({layout.pageHeightMm} mm)
            </span>
            <div className="dim-line bottom-line" />
          </div>

          {/* The Actual Scaled A4 Sheet Canvas */}
          <div
            className={`a4-sheet-canvas ${viewMode === "blueprint" ? "blueprint-theme" : "print-theme"}`}
            style={{ aspectRatio }}
          >
            {/* Blueprint Grid Background Pattern */}
            {viewMode === "blueprint" && <div className="bp-grid-lines" />}

            {/* Margin Guides */}
            <div
              className="printable-boundary"
              style={{
                left: `${(layout.marginLeftMm / layout.pageWidthMm) * 100}%`,
                top: `${(layout.marginTopMm / layout.pageHeightMm) * 100}%`,
                width: `${
                  ((layout.columns * layout.cardWidthMm + (layout.columns - 1) * layout.gapMm) /
                    layout.pageWidthMm) *
                  100
                }%`,
                height: `${
                  ((layout.rows * layout.cardHeightMm + (layout.rows - 1) * layout.gapMm) /
                    layout.pageHeightMm) *
                  100
                }%`,
              }}
            />

            {/* Card Slots */}
            {layout.slots.map((slot) => {
              const student = currentBatch[slot.slotIndex];
              const isOccupied = Boolean(student);
              const isSelected = selectedSlotIndex === slot.slotIndex;

              const leftPercent = (slot.xMm / layout.pageWidthMm) * 100;
              const topPercent = (slot.yMm / layout.pageHeightMm) * 100;
              const widthPercent = (layout.cardWidthMm / layout.pageWidthMm) * 100;
              const heightPercent = (layout.cardHeightMm / layout.pageHeightMm) * 100;

              return (
                <div
                  key={slot.slotIndex}
                  className={`card-slot-box ${isOccupied ? "occupied" : "empty"} ${
                    isSelected ? "selected" : ""
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    top: `${topPercent}%`,
                    width: `${widthPercent}%`,
                    height: `${heightPercent}%`,
                  }}
                  onClick={() => setSelectedSlotIndex(slot.slotIndex)}
                >
                  {/* Corner Cut Guides */}
                  <div className="cut-corner tl" />
                  <div className="cut-corner tr" />
                  <div className="cut-corner bl" />
                  <div className="cut-corner br" />

                  {viewMode === "blueprint" ? (
                    /* Technical Blueprint Schematic Card View */
                    <div className="bp-card-interior">
                      <div className="bp-card-header">
                        <div className="bp-slot-tag">
                          <span className="bp-tag-num">SLOT {slot.slotIndex + 1}</span>
                          <span className="bp-dim-badge">
                            {settings.widthCm} × {settings.heightCm} cm
                          </span>
                        </div>
                        <span className="bp-card-inst">
                          {settings.institutionName || "MODEL PUBLIC SCHOOL"}
                        </span>
                      </div>

                      {isOccupied ? (
                        <div className="bp-card-body">
                          <div className="bp-card-fields">
                            <div className="bp-dynamic-name-row">
                              <small>STUDENT NAME</small>
                              <strong className="bp-name-value">{student.name}</strong>
                            </div>
                            <div className="bp-meta-grid">
                              <div>
                                <small>CLASS</small>
                                <span>{student.className || "—"}</span>
                              </div>
                              <div>
                                <small>DOB</small>
                                <span>{student.dob || "—"}</span>
                              </div>
                              <div>
                                <small>MOBILE</small>
                                <span>{student.mobile || "—"}</span>
                              </div>
                              <div>
                                <small>PARENTAGE</small>
                                <span className="bp-truncate">{student.parentage || "—"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bp-photo-zone">
                            {student.photo ? (
                              <img src={student.photo} alt={student.name} className="bp-photo-thumb" />
                            ) : (
                              <div className="bp-photo-placeholder">
                                <span>PHOTO</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bp-empty-slot">
                          <div className="bp-empty-dash-icon">+</div>
                          <span>EMPTY SLOT</span>
                          <small>No student assigned to this slot</small>
                        </div>
                      )}

                      <div className="bp-card-footer">
                        <span>YEAR: {issueYear}</span>
                        <span>{settings.cardTitle || "STUDENT IDENTITY CARD"}</span>
                      </div>
                    </div>
                  ) : (
                    /* Rendered Print Realistic Card View */
                    <div className="print-card-interior">
                      {isOccupied ? (
                        <>
                          <div className="rendered-card-header">
                            <b>{settings.institutionName || "MODEL PUBLIC SCHOOL"}</b>
                            <span>{settings.subHeader || "DEPARTMENT OF EDUCATION"}</span>
                          </div>

                          <div className="rendered-card-body">
                            <div className="rendered-card-info">
                              <p>
                                <small>NAME</small>
                                <b className="student-highlight-name">{student.name}</b>
                              </p>
                              <p>
                                <small>PARENTAGE</small>
                                <b>{student.parentage || "—"}</b>
                              </p>
                              <p>
                                <small>CLASS</small>
                                <b>{student.className || "—"}</b>
                              </p>
                              <p>
                                <small>DATE OF BIRTH</small>
                                <b>{student.dob || "—"}</b>
                              </p>
                              <p>
                                <small>MOBILE</small>
                                <b>{student.mobile || "—"}</b>
                              </p>
                            </div>

                            <div className="rendered-card-photo">
                              {student.photo ? (
                                <img src={student.photo} alt={student.name} />
                              ) : (
                                <span>PHOTO</span>
                              )}
                            </div>
                          </div>

                          <div className="rendered-card-footer">
                            <b>YEAR OF ISSUE: {issueYear}</b>
                            <span>{settings.cardTitle || "STUDENT IDENTITY CARD"}</span>
                          </div>
                        </>
                      ) : (
                        <div className="rendered-empty-slot">
                          <span>EMPTY SLOT</span>
                          <small>Cut-ready slot</small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Blueprint Technical Drawing Block */}
            {viewMode === "blueprint" && (
              <div className="blueprint-title-block">
                <div className="btb-row btb-head">
                  <strong>A4 SHEET ID IMPOSITION BLUEPRINT</strong>
                </div>
                <div className="btb-row">
                  <span>INSTITUTION:</span>
                  <b>{settings.institutionName || "MODEL PUBLIC SCHOOL"}</b>
                </div>
                <div className="btb-row">
                  <span>CARD SIZE:</span>
                  <b>
                    {settings.widthCm} × {settings.heightCm} cm (Gap: {layout.gapMm} mm)
                  </b>
                </div>
                <div className="btb-row">
                  <span>GRID CAPACITY:</span>
                  <b>
                    {layout.columns} × {layout.rows} ({layout.cardsPerPage} cards/sheet)
                  </b>
                </div>
                <div className="btb-row">
                  <span>ON THIS PAGE:</span>
                  <b>
                    {cardsOnCurrentPage} card{cardsOnCurrentPage === 1 ? "" : "s"}
                  </b>
                </div>
                <div className="btb-row">
                  <span>PAGE / TOTAL:</span>
                  <b>
                    Sheet {activePage + 1} of {totalPages}
                  </b>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Slot Detailed View Popover / Card Inspection */}
      {selectedSlotIndex !== null && (
        <div className="slot-detail-bar">
          <div className="slot-detail-meta">
            <span className="slot-badge">Slot #{selectedSlotIndex + 1}</span>
            {currentBatch[selectedSlotIndex] ? (
              <span className="slot-name-tag">
                Assigned: <strong>{currentBatch[selectedSlotIndex].name}</strong> (
                {currentBatch[selectedSlotIndex].className || "No class"} ·{" "}
                {currentBatch[selectedSlotIndex].photo ? "Photo saved" : "Pending photo"})
              </span>
            ) : (
              <span className="slot-empty-tag">This slot will be blank / empty on the printed sheet</span>
            )}
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => setSelectedSlotIndex(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
