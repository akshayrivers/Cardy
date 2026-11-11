import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { importWorkbook } from "./excel";
import { generatePdf } from "./pdf";
import { loadState, saveState, clearState } from "./storage";
import type { Student, CardSettings } from "./types";
import { DEFAULT_CARD_SETTINGS } from "./types";
import { BlueprintPreview } from "./BlueprintPreview";
import { computePageLayout, CARD_PRESETS } from "./layout";

type Tab = "students" | "photos" | "print";

const emptyStudent: Student = {
  id: "",
  name: "",
  parentage: "",
  className: "",
  dob: "",
  mobile: "",
  admissionNumber: ""
};

function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [issueYear, setIssueYear] = useState(String(new Date().getFullYear()));
  const [cardSettings, setCardSettings] = useState<CardSettings>(DEFAULT_CARD_SETTINGS);
  const [activePreset, setActivePreset] = useState("default-104-70");
  const [namesMode, setNamesMode] = useState<"database" | "custom">("database");
  const [customNamesText, setCustomNamesText] = useState("");
  const [printScope, setPrintScope] = useState<"all" | "filtered" | "selected">("all");

  const [tab, setTab] = useState<Tab>("students");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("All classes");
  const [selectedId, setSelectedId] = useState("");
  const [edit, setEdit] = useState<Student | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadState().then(saved => {
      setStudents(saved.students);
      setIssueYear(saved.settings.issueYear);
      if (saved.settings.card) {
        setCardSettings(saved.settings.card);
        const match = CARD_PRESETS.find(
          p =>
            Math.abs(p.widthCm - saved.settings.card.widthCm) < 0.05 &&
            Math.abs(p.heightCm - saved.settings.card.heightCm) < 0.05
        );
        setActivePreset(match ? match.id : "custom");
      }
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
      setError("Could not open local storage in this browser.");
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      saveState(students, { issueYear, card: cardSettings }).catch(() =>
        setError("Could not save changes locally.")
      );
    }
  }, [students, issueYear, cardSettings, loaded]);

  useEffect(() => () => stopCamera(), []);

  const layout = useMemo(() => computePageLayout(cardSettings), [cardSettings]);

  const classes = useMemo(
    () => [
      "All classes",
      ...Array.from(new Set(students.map(s => s.className).filter(Boolean))).sort()
    ],
    [students]
  );

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchesQuery = [s.name, s.parentage, s.mobile, s.admissionNumber]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      return matchesQuery && (classFilter === "All classes" || s.className === classFilter);
    });
  }, [students, query, classFilter]);

  const selected = students.find(s => s.id === selectedId) ?? null;
  const photoCount = students.filter(s => Boolean(s.photo)).length;
  const pendingCount = students.length - photoCount;

  // Custom dynamically-entered student names
  const customStudents = useMemo<Student[]>(() => {
    if (!customNamesText.trim()) {
      return [
        { id: "demo-1", name: "Aarav Sharma", parentage: "S/o Ramesh Sharma", className: "6th", dob: "12/04/2014", mobile: "9876543210", admissionNumber: "101" },
        { id: "demo-2", name: "Priya Devi", parentage: "D/o Mohan Lal", className: "7th", dob: "05/09/2013", mobile: "9876543211", admissionNumber: "102" },
        { id: "demo-3", name: "Karan Verma", parentage: "S/o Vijay Kumar", className: "8th", dob: "18/11/2012", mobile: "9876543212", admissionNumber: "103" },
        { id: "demo-4", name: "Sneha Kumari", parentage: "D/o Rajinder Singh", className: "6th", dob: "22/01/2014", mobile: "9876543213", admissionNumber: "104" }
      ];
    }
    const lines = customNamesText
      .split(/[\r\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    return lines.map((name, i) => ({
      id: `custom-${i}`,
      name,
      parentage: "Parent / Guardian",
      className: "General",
      dob: "—",
      mobile: "—",
      admissionNumber: String(100 + i + 1)
    }));
  }, [customNamesText]);

  // Which list of cards/students is currently active for preview & print
  const activePrintStudents = useMemo<Student[]>(() => {
    if (namesMode === "custom") return customStudents;
    if (printScope === "selected" && selected) return [selected];
    if (printScope === "filtered") return filtered;
    return students;
  }, [namesMode, customStudents, printScope, selected, filtered, students]);

  function handlePresetSelect(presetId: string) {
    setActivePreset(presetId);
    const p = CARD_PRESETS.find(pr => pr.id === presetId);
    if (p) {
      setCardSettings(cur => ({
        ...cur,
        widthCm: p.widthCm,
        heightCm: p.heightCm
      }));
    }
  }

  function handleDimensionChange(field: "widthCm" | "heightCm" | "gapMm", value: number) {
    setCardSettings(cur => {
      const next = { ...cur, [field]: value };
      const match = CARD_PRESETS.find(
        p =>
          Math.abs(p.widthCm - next.widthCm) < 0.05 &&
          Math.abs(p.heightCm - next.heightCm) < 0.05
      );
      setActivePreset(match ? match.id : "custom");
      return next;
    });
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");
    try {
      const imported = await importWorkbook(file);
      const existing = new Map(students.map(s => [s.id, s]));
      const merged = imported.map(s => ({ ...s, photo: existing.get(s.id)?.photo }));
      setStudents(merged);
      setSelectedId(merged[0]?.id ?? "");
      setMessage(`Imported ${merged.length} student records. Only the required fields were read.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Excel import failed.");
    }
    e.target.value = "";
  }

  function updateStudent(updated: Student) {
    setStudents(current => current.map(s => (s.id === updated.id ? updated : s)));
  }

  function openEditor(student: Student) {
    setEdit({ ...student });
  }

  function saveEditor() {
    if (!edit) return;
    if (!edit.name.trim()) {
      setError("Student name is required.");
      return;
    }
    const exists = students.some(s => s.id === edit.id);
    if (exists) updateStudent(edit);
    else {
      setStudents(current => [...current, edit]);
      setSelectedId(edit.id);
    }
    setEdit(null);
    setError("");
  }

  function setPhoto(id: string, dataUrl: string) {
    setStudents(current => current.map(s => (s.id === id ? { ...s, photo: dataUrl } : s)));
    setSelectedId(id);
    setMessage("Photograph saved on this device.");
  }

  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 1000;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhoto(selected.id, canvas.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = () => setError("Could not read that image.");
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function startCamera() {
    if (!selected) {
      setError("Select a student first.");
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 80);
    } catch {
      setError(
        "Camera access failed. Use HTTPS or localhost and allow camera permission, or upload a photograph instead."
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !selected) return;
    const canvas = document.createElement("canvas");
    const max = 1000;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(selected.id, canvas.toDataURL("image/jpeg", 0.88));
    stopCamera();
  }

  async function exportPdf(list: Student[]) {
    if (!list.length) {
      setError("There are no cards/students to export.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const bytes = await generatePdf(
        list,
        issueYear.trim() || String(new Date().getFullYear()),
        cardSettings
      );
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sanitizedInst = (cardSettings.institutionName || "School-ID").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `${sanitizedInst}-Cards-${cardSettings.widthCm}x${cardSettings.heightCm}cm-${issueYear || "year"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      const totalSheets = Math.ceil(list.length / layout.cardsPerPage);
      setMessage(
        `Generated ${list.length} cards across ${totalSheets} A4 sheet(s) (${cardSettings.widthCm} × ${cardSettings.heightCm} cm · ${layout.cardsPerPage} cards per page).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resetAll() {
    if (
      !window.confirm(
        "Delete all student records and photographs stored in this browser? Export a backup first if needed."
      )
    )
      return;
    await clearState();
    setStudents([]);
    setSelectedId("");
    setMessage("Local student data cleared.");
  }

  const effectiveTotalStudents = namesMode === "custom" ? customStudents.length : students.length;
  const totalSheetsNeeded = Math.ceil(effectiveTotalStudents / layout.cardsPerPage) || 0;

  const brandMark = useMemo(() => {
    const raw = (cardSettings.institutionName || "School").trim();
    const initials = raw
      .split(/[\s,.-]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(w => w[0])
      .join("")
      .toUpperCase();
    return initials || "ID";
  }, [cardSettings.institutionName]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" title="Institution Brand Mark">{brandMark}</div>
        <div className="topbar-details">
          <div className="eyebrow">STUDENT ADMINISTRATION</div>
          <input
            type="text"
            className="topbar-input topbar-inst-input"
            value={cardSettings.institutionName}
            onChange={e =>
              setCardSettings(cur => ({ ...cur, institutionName: e.target.value }))
            }
            placeholder="e.g. Model Public School"
            title="Click to edit Institution / School Name"
          />
          <input
            type="text"
            className="topbar-input topbar-sub-input"
            value={cardSettings.subHeader}
            onChange={e =>
              setCardSettings(cur => ({ ...cur, subHeader: e.target.value }))
            }
            placeholder="e.g. Department of Education · Zone"
            title="Click to edit Sub-header / Department"
          />
        </div>
        <div className="year-control">
          <label htmlFor="issueYear">Year of issue</label>
          <input
            id="issueYear"
            value={issueYear}
            onChange={e => setIssueYear(e.target.value)}
            maxLength={12}
          />
        </div>
      </header>

      <section className="stats">
        <div className="stat">
          <span>Total students</span>
          <strong>{students.length}</strong>
        </div>
        <div className="stat">
          <span>Card dimensions</span>
          <strong>{cardSettings.widthCm} × {cardSettings.heightCm} cm</strong>
        </div>
        <div className="stat">
          <span>Cards per A4 page</span>
          <strong>{layout.cardsPerPage} ({layout.columns}×{layout.rows})</strong>
        </div>
        <div className="stat">
          <span>A4 sheets required</span>
          <strong>{totalSheetsNeeded}</strong>
        </div>
      </section>

      <nav className="tabs">
        <button
          className={tab === "students" ? "active" : ""}
          onClick={() => setTab("students")}
        >
          Students
        </button>
        <button
          className={tab === "photos" ? "active" : ""}
          onClick={() => setTab("photos")}
        >
          Photographs ({photoCount}/{students.length})
        </button>
        <button
          className={tab === "print" ? "active" : ""}
          onClick={() => setTab("print")}
        >
          📐 Blueprint & Print Generator
        </button>
      </nav>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      {tab === "students" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Student records</h2>
              <p>Import the school Excel sheet or maintain records manually.</p>
            </div>
            <label className="button primary">
              Import Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} hidden />
            </label>
          </div>
          <div className="toolbar">
            <input
              className="search"
              placeholder="Search name, parentage, mobile or admission no."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
            >
              {classes.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              className="button secondary"
              onClick={() => {
                setEdit({ ...emptyStudent, id: `manual-${Date.now()}` });
              }}
            >
              Add student
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Parentage</th>
                  <th>Class</th>
                  <th>Date of birth</th>
                  <th>Mobile</th>
                  <th>Photo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="student-cell">
                      {s.name}
                      <small>
                        {s.admissionNumber
                          ? `Admission no. ${s.admissionNumber}`
                          : "Manual record"}
                      </small>
                    </td>
                    <td>{s.parentage || "—"}</td>
                    <td>{s.className || "—"}</td>
                    <td>{s.dob || "—"}</td>
                    <td>{s.mobile || "—"}</td>
                    <td>
                      <span className={s.photo ? "badge done" : "badge pending"}>
                        {s.photo ? "Saved" : "Pending"}
                      </span>
                    </td>
                    <td>
                      <button className="text-button" onClick={() => openEditor(s)}>
                        Edit
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSelectedId(s.id);
                          setTab("photos");
                        }}
                      >
                        Photo
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="empty">
                      No records found. Import the Excel file to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "photos" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Photograph collection</h2>
              <p>Select a student, then capture a webcam photo or upload one.</p>
            </div>
          </div>
          <div className="photo-workspace">
            <div className="student-picker">
              <input
                className="search"
                placeholder="Find a student..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <div className="picker-list">
                {filtered.map(s => (
                  <button
                    key={s.id}
                    className={`picker-item ${selectedId === s.id ? "chosen" : ""}`}
                    onClick={() => {
                      setSelectedId(s.id);
                      stopCamera();
                    }}
                  >
                    <span className="avatar">
                      {s.photo ? (
                        <img src={s.photo} alt={s.name} />
                      ) : (
                        s.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span>
                      <b>{s.name}</b>
                      <small>
                        {s.className} · {s.parentage}
                      </small>
                    </span>
                    <i className={s.photo ? "dot green" : "dot"} />
                  </button>
                ))}
              </div>
            </div>
            <div className="photo-editor">
              {selected ? (
                <>
                  <div className="selected-title">
                    <div>
                      <h3>{selected.name}</h3>
                      <p>
                        {selected.className} · {selected.parentage}
                      </p>
                    </div>
                    <span
                      className={selected.photo ? "badge done" : "badge pending"}
                    >
                      {selected.photo ? "Photo saved" : "No photo yet"}
                    </span>
                  </div>
                  {cameraOpen ? (
                    <div className="camera-box">
                      <video ref={videoRef} autoPlay playsInline muted />
                      <div className="camera-actions">
                        <button
                          className="button primary"
                          onClick={capturePhoto}
                        >
                          Capture photograph
                        </button>
                        <button
                          className="button secondary"
                          onClick={stopCamera}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="photo-preview">
                      {selected.photo ? (
                        <img src={selected.photo} alt={selected.name} />
                      ) : (
                        <div className="photo-placeholder">
                          <span>PHOTO</span>
                          <small>Capture or upload a student photograph</small>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="photo-actions">
                    <button className="button primary" onClick={startCamera}>
                      Open camera
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => fileRef.current?.click()}
                    >
                      Upload photograph
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handlePhotoUpload}
                    />
                    {selected.photo && (
                      <button
                        className="button danger"
                        onClick={() =>
                          setStudents(cur =>
                            cur.map(s =>
                              s.id === selected.id
                                ? { ...s, photo: undefined }
                                : s
                            )
                          )
                        }
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                  <p className="hint">
                    Photos are resized and stored in this browser on this device.
                    Camera access generally requires localhost or HTTPS.
                  </p>
                </>
              ) : (
                <div className="empty-state">
                  Import student records, then select a student here.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "print" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>📐 Blueprint Preview & ID Card Generator</h2>
              <p>
                Adjust card dimensions, customize card headers/names, and inspect the A4 blueprint preview before printing.
              </p>
            </div>
          </div>

          <div className="print-grid-layout">
            {/* Left Column: Controls & Settings */}
            <div className="print-controls-col">
              {/* 1. Adjustable Card Size */}
              <div className="config-card">
                <div className="config-title">
                  <h3>📐 Card Size & Dimensions</h3>
                  <span className="badge-pill">
                    {cardSettings.widthCm} × {cardSettings.heightCm} cm
                  </span>
                </div>

                <div className="preset-chips">
                  {CARD_PRESETS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`preset-chip ${activePreset === p.id ? "active" : ""}`}
                      onClick={() => handlePresetSelect(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`preset-chip ${activePreset === "custom" ? "active" : ""}`}
                    onClick={() => setActivePreset("custom")}
                  >
                    Custom Size
                  </button>
                </div>

                <div className="dim-inputs">
                  <div className="dim-field">
                    <label>Width (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="3"
                      max="25"
                      value={cardSettings.widthCm}
                      onChange={e =>
                        handleDimensionChange("widthCm", parseFloat(e.target.value) || 10.4)
                      }
                    />
                  </div>

                  <div className="dim-field">
                    <label>Height (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="3"
                      max="25"
                      value={cardSettings.heightCm}
                      onChange={e =>
                        handleDimensionChange("heightCm", parseFloat(e.target.value) || 7.0)
                      }
                    />
                  </div>

                  <div className="dim-field">
                    <label>Gap / Spacing (mm)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="20"
                      value={cardSettings.gapMm}
                      onChange={e =>
                        handleDimensionChange("gapMm", parseFloat(e.target.value) || 4)
                      }
                    />
                  </div>

                  <div className="dim-field">
                    <label>Sheet Orientation</label>
                    <select
                      value={cardSettings.orientation}
                      onChange={e =>
                        setCardSettings(cur => ({
                          ...cur,
                          orientation: e.target.value as any
                        }))
                      }
                    >
                      <option value="landscape">Landscape (Recommended)</option>
                      <option value="portrait">Portrait</option>
                      <option value="auto">Auto (Best Fit)</option>
                    </select>
                  </div>
                </div>

                <div className="capacity-callout">
                  <span>A4 Imposition:</span>
                  <strong>
                    {layout.columns} cols × {layout.rows} rows = {layout.cardsPerPage} cards per page
                  </strong>
                </div>
              </div>

              {/* 2. Dynamic Card Titles / Names */}
              <div className="config-card">
                <div className="config-title">
                  <h3>🏷️ Dynamic Card Titles & Names</h3>
                </div>

                <div className="dim-field" style={{ marginBottom: "10px" }}>
                  <label>Institution / School Name</label>
                  <input
                    value={cardSettings.institutionName}
                    onChange={e =>
                      setCardSettings(cur => ({ ...cur, institutionName: e.target.value }))
                    }
                    placeholder="e.g. Model Public School"
                  />
                </div>

                <div className="dim-field" style={{ marginBottom: "10px" }}>
                  <label>Sub-header / Zone / Department</label>
                  <input
                    value={cardSettings.subHeader}
                    onChange={e =>
                      setCardSettings(cur => ({ ...cur, subHeader: e.target.value }))
                    }
                    placeholder="e.g. Department of Education"
                  />
                </div>

                <div className="dim-field">
                  <label>Card Type / Bottom Label</label>
                  <input
                    value={cardSettings.cardTitle}
                    onChange={e =>
                      setCardSettings(cur => ({ ...cur, cardTitle: e.target.value }))
                    }
                    placeholder="e.g. STUDENT IDENTITY CARD"
                  />
                </div>
              </div>

              {/* 3. Dynamic Card Names Source & Selection */}
              <div className="config-card">
                <div className="config-title">
                  <h3>👥 Dynamic Card Names</h3>
                  <span className="badge-pill">
                    {activePrintStudents.length} card{activePrintStudents.length === 1 ? "" : "s"} selected
                  </span>
                </div>

                <div className="mode-tabs">
                  <button
                    type="button"
                    className={`mode-tab-btn ${namesMode === "database" ? "active" : ""}`}
                    onClick={() => setNamesMode("database")}
                  >
                    From Student Records ({students.length})
                  </button>
                  <button
                    type="button"
                    className={`mode-tab-btn ${namesMode === "custom" ? "active" : ""}`}
                    onClick={() => setNamesMode("custom")}
                  >
                    Quick Dynamic Names Entry
                  </button>
                </div>

                {namesMode === "database" ? (
                  <div className="scope-selection">
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                      <button
                        type="button"
                        className={`preset-chip ${printScope === "all" ? "active" : ""}`}
                        onClick={() => setPrintScope("all")}
                      >
                        All Students ({students.length})
                      </button>
                      <button
                        type="button"
                        className={`preset-chip ${printScope === "filtered" ? "active" : ""}`}
                        onClick={() => setPrintScope("filtered")}
                      >
                        Filtered ({filtered.length})
                      </button>
                      {selected && (
                        <button
                          type="button"
                          className={`preset-chip ${printScope === "selected" ? "active" : ""}`}
                          onClick={() => setPrintScope("selected")}
                        >
                          Selected: {selected.name}
                        </button>
                      )}
                    </div>
                    <p className="hint" style={{ margin: 0 }}>
                      The blueprint dynamically loads student names and details from your stored database.
                    </p>
                  </div>
                ) : (
                  <div className="custom-names-box">
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#546e82", display: "block", marginBottom: "5px" }}>
                      Enter or paste names (one per line):
                    </label>
                    <textarea
                      className="names-textarea"
                      placeholder={`Aarav Sharma\nPriya Devi\nKaran Verma\nSneha Kumari`}
                      value={customNamesText}
                      onChange={e => setCustomNamesText(e.target.value)}
                    />
                    <p className="hint" style={{ marginTop: "5px" }}>
                      Cards are dynamically generated for each entered name and shown on the blueprint in real time!
                    </p>
                  </div>
                )}
              </div>

              {/* 4. PDF Generation & Printing Instructions */}
              <div className="config-card">
                <button
                  type="button"
                  className="button primary large"
                  disabled={!activePrintStudents.length || busy}
                  onClick={() => exportPdf(activePrintStudents)}
                >
                  {busy ? "Generating PDF…" : `Generate & Download PDF (${activePrintStudents.length} cards)`}
                </button>

                <div className="warning-box">
                  <b>Printing Instructions for A4:</b>
                  <p>
                    In your PDF reader / browser print dialog:
                    <br />• Paper: <b>A4</b>
                    <br />• Orientation: <b>{layout.isLandscape ? "Landscape" : "Portrait"}</b>
                    <br />• Scale: <b>Actual size (100%)</b> — Turn off "Fit to printable area"
                    <br />• Use corner crop guides to accurately cut cards to <b>{cardSettings.widthCm} × {cardSettings.heightCm} cm</b>.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Blueprint Preview & Single Card Inspection */}
            <div className="print-preview-col">
              <BlueprintPreview
                students={activePrintStudents}
                settings={cardSettings}
                issueYear={issueYear}
              />

              {/* Single Card Detailed Inspection */}
              <div className="preview-area" style={{ marginTop: "20px" }}>
                <span className="eyebrow">SINGLE CARD DESIGN INSPECTION</span>
                <div
                  className="card-preview"
                  style={{
                    aspectRatio: `${cardSettings.widthCm} / ${cardSettings.heightCm}`,
                    maxWidth: "380px"
                  }}
                >
                  <div className="card-head">
                    <b>{cardSettings.institutionName || "MODEL PUBLIC SCHOOL"}</b>
                    <span>{cardSettings.subHeader || "DEPARTMENT OF EDUCATION"}</span>
                  </div>
                  <div className="card-body">
                    <div className="preview-fields">
                      <p>
                        <small>NAME</small>
                        <b>{activePrintStudents[0]?.name || "Student Name"}</b>
                      </p>
                      <p>
                        <small>PARENTAGE</small>
                        <b>{activePrintStudents[0]?.parentage || "Parent / Guardian"}</b>
                      </p>
                      <p>
                        <small>CLASS</small>
                        <b>{activePrintStudents[0]?.className || "Class"}</b>
                      </p>
                      <p>
                        <small>DATE OF BIRTH</small>
                        <b>{activePrintStudents[0]?.dob || "DD/MM/YYYY"}</b>
                      </p>
                      <p>
                        <small>MOBILE</small>
                        <b>{activePrintStudents[0]?.mobile || "Mobile number"}</b>
                      </p>
                    </div>
                    <div className="preview-photo">
                      {activePrintStudents[0]?.photo ? (
                        <img
                          src={activePrintStudents[0].photo}
                          alt="Photo"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        "PHOTO"
                      )}
                    </div>
                  </div>
                  <div className="card-foot">
                    <b>YEAR OF ISSUE: {issueYear}</b>
                    <span>{cardSettings.cardTitle || "STUDENT IDENTITY CARD"}</span>
                  </div>
                </div>
                <p className="hint">
                  Card design dynamically adapts to <b>{cardSettings.widthCm} × {cardSettings.heightCm} cm</b>.
                </p>
              </div>
            </div>
          </div>

          <div className="privacy-note">
            <b>Local data and privacy</b>
            <p>
              Student details and photographs remain in this browser's IndexedDB storage. They are not sent to a server.
              Use this only on a school-authorized device, protect access to the device, and follow school/parental authorization requirements.
            </p>
            <button className="text-button danger-text" onClick={resetAll}>
              Delete all local student data
            </button>
          </div>
        </section>
      )}

      {edit && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setEdit(null);
          }}
        >
          <div className="modal">
            <div className="modal-title">
              <div>
                <h2>
                  {students.some(s => s.id === edit.id)
                    ? "Edit student"
                    : "Add student"}
                </h2>
                <p>Only the information printed on the card is required.</p>
              </div>
              <button className="close" onClick={() => setEdit(null)}>
                ×
              </button>
            </div>
            <div className="form-grid">
              <label>
                Student name
                <input
                  value={edit.name}
                  onChange={e => setEdit({ ...edit, name: e.target.value })}
                />
              </label>
              <label>
                Parentage
                <input
                  value={edit.parentage}
                  onChange={e => setEdit({ ...edit, parentage: e.target.value })}
                />
              </label>
              <label>
                Class
                <input
                  value={edit.className}
                  onChange={e => setEdit({ ...edit, className: e.target.value })}
                />
              </label>
              <label>
                Date of birth
                <input
                  value={edit.dob}
                  onChange={e => setEdit({ ...edit, dob: e.target.value })}
                  placeholder="DD/MM/YYYY"
                />
              </label>
              <label>
                Mobile number
                <input
                  value={edit.mobile}
                  onChange={e => setEdit({ ...edit, mobile: e.target.value })}
                />
              </label>
              <label>
                Admission number (internal)
                <input
                  value={edit.admissionNumber}
                  onChange={e =>
                    setEdit({ ...edit, admissionNumber: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button className="button primary" onClick={saveEditor}>
                Save student
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>
        {cardSettings.institutionName || "Student ID Card System"} · Local privacy-first utility <span>Data stays on this device</span>
      </footer>
    </main>
  );
}

export default App;
