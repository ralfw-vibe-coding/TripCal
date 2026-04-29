import {
  CalendarDays,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Upload,
  X,
} from "lucide-react";
import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarBooking } from "../../domain/model";
import { submitDocumentFiles, submitDocumentImage, submitDocumentText, viewBookingCalendar } from "./api";

type PastedImage = {
  dataUrl: string;
  mimeType: string;
};

type PendingFile = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  dataBase64: string;
};

type SubmitTab = "files" | "text";

export function App() {
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [text, setText] = useState("");
  const [pastedImage, setPastedImage] = useState<PastedImage | undefined>();
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [submitTab, setSubmitTab] = useState<SubmitTab>("files");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadCalendar() {
    setIsLoadingCalendar(true);
    try {
      const response = await viewBookingCalendar();
      setBookings(response.bookings);
    } finally {
      setIsLoadingCalendar(false);
    }
  }

  useEffect(() => {
    void loadCalendar();
  }, []);

  useEffect(() => {
    if (showSubmit && submitTab === "text" && !pastedImage) {
      window.setTimeout(() => textAreaRef.current?.focus(), 0);
    }
  }, [showSubmit, pastedImage, submitTab]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const response =
        pendingFiles.length > 0
          ? await submitDocumentFiles(pendingFiles)
          : pastedImage
            ? await submitDocumentImage(pastedImage.dataUrl, pastedImage.mimeType)
            : await submitDocumentText(text);

      if (response.status === "accepted") {
        setMessage(`${response.bookingExtractedIds.length} Buchung(en) extrahiert.`);
        setShowSubmit(false);
        await loadCalendar();
      } else {
        setMessage(response.message);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unerwarteter Fehler.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const groupedBookings = useMemo(() => groupBookingsByDate(bookings), [bookings]);

  return (
    <main className="appShell">
      <header className="topBar">
        <div>
          <div className="eyebrow">TripCal</div>
          <h1>Buchungskalender</h1>
        </div>
        <div className="toolbar">
          <button className="iconButton" type="button" onClick={loadCalendar} title="Kalender aktualisieren">
            {isLoadingCalendar ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
          <button className="primaryButton" type="button" onClick={openSubmitDialog}>
            <Plus size={18} />
            Dokument
          </button>
        </div>
      </header>

      {message ? <div className="notice">{message}</div> : null}

      <section className="calendarSurface" aria-label="Buchungskalender">
        {isLoadingCalendar ? (
          <div className="emptyState">
            <Loader2 className="spin" size={24} />
            Kalender wird geladen
          </div>
        ) : bookings.length === 0 ? (
          <div className="emptyState">
            <CalendarDays size={28} />
            <span>Noch keine Buchungen erfasst.</span>
          </div>
        ) : (
          groupedBookings.map((group) => (
            <section className="dayGroup" key={group.date}>
              <div className="dateRail">
                <span>{formatDate(group.date)}</span>
              </div>
              <div className="bookingList">
                {group.bookings.map((booking) => (
                  <article className="bookingCard" key={booking.bookingExtractedId}>
                    <div className="bookingHeader">
                      <div>
                        <div className="bookingMeta">{formatRange(booking)}</div>
                        <h2>{booking.title}</h2>
                      </div>
                      <span className="statusPill">{booking.status === "needs_review" ? "Review" : booking.status}</span>
                    </div>
                    <div className="routeLine">
                      <span>{booking.from?.name ?? "Start offen"}</span>
                      <span className="arrow">→</span>
                      <span>{booking.to?.name ?? "Ziel offen"}</span>
                    </div>
                    {booking.travelers.length > 0 ? (
                      <div className="travelers">{booking.travelers.join(", ")}</div>
                    ) : null}
                    <pre className="details">{booking.details}</pre>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </section>

      {showSubmit ? (
        <div className="dialogBackdrop" role="presentation">
          <section className="dialog" aria-label="Dokument einreichen" onPaste={handleDialogPaste}>
            <header className="dialogHeader">
              <div>
                <div className="eyebrow">Dokument einreichen</div>
                <h2>{dialogTitle()}</h2>
              </div>
              <button className="iconButton" type="button" onClick={() => setShowSubmit(false)} title="Schließen">
                <X size={18} />
              </button>
            </header>

            <div className="tabs" role="tablist" aria-label="Eingabeart">
              <button
                className={submitTab === "files" ? "tabButton active" : "tabButton"}
                type="button"
                onClick={() => switchTab("files")}
              >
                Dateien
              </button>
              <button
                className={submitTab === "text" ? "tabButton active" : "tabButton"}
                type="button"
                onClick={() => switchTab("text")}
              >
                Text / Clipboard
              </button>
            </div>

            {submitTab === "files" ? (
              <div className="fileUploadPanel">
                <button
                  className={isDraggingFiles ? "dropZone dragging" : "dropZone"}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleFileDragEnter}
                  onDragOver={handleFileDragOver}
                  onDragLeave={handleFileDragLeave}
                  onDrop={handleFileDrop}
                >
                  <Upload size={30} />
                  <span>Ziehe Dokumente hierher oder klicke hier, um sie auszuwählen.</span>
                </button>
                <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileInputChange} />
                {pendingFiles.length > 0 ? (
                  <div className="fileList">
                    {pendingFiles.map((file) => (
                      <div className="fileItem" key={file.id}>
                        <div>
                          <div className="fileName">{file.fileName}</div>
                          <div className="fileMeta">
                            {file.mimeType || "unbekannter Typ"} · {formatBytes(file.sizeBytes)}
                          </div>
                        </div>
                        <button
                          className="fileRemoveButton"
                          type="button"
                          onClick={() => removePendingFile(file.id)}
                          title="Datei entfernen"
                        >
                          <X size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : pastedImage ? (
              <div className="imagePreviewPanel">
                <div className="imagePreviewFrame">
                  <img className="imagePreview" src={pastedImage.dataUrl} alt="Eingefügtes Dokument" />
                </div>
                <button className="imageRemoveButton" type="button" onClick={clearPastedImage} title="Bild entfernen">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <textarea
                ref={textAreaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Dokumenttext eingeben oder Text/Bild aus der Zwischenablage einfügen"
              />
            )}

            <footer className="dialogFooter">
              <div className="hint">
                {hintIcon()}
                {pastedImage
                  ? "Das Bild wird nur zur Texterkennung verwendet und nicht gespeichert."
                  : submitTab === "files"
                    ? "Dateien werden lokal gespeichert; PDF- und Bilddateien können per KI ausgelesen werden."
                    : "Text direkt erfassen, einfügen oder mehrere Buchungen mit --- trennen."}
              </div>
              <button className="primaryButton" type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                Einreichen
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );

  function openSubmitDialog() {
    setText("");
    setPastedImage(undefined);
    setPendingFiles([]);
    setSubmitTab("files");
    setIsDraggingFiles(false);
    setMessage(undefined);
    setShowSubmit(true);
  }

  async function handleDialogPaste(event: ClipboardEvent<HTMLElement>) {
    const imageItem = [...event.clipboardData.items].find((item) => item.type.startsWith("image/"));
    if (!imageItem) {
      const pastedText = event.clipboardData.getData("text/plain");
      if (pastedText.trim().length > 0) {
        setSubmitTab("text");
        setPendingFiles([]);
      }
      return;
    }

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    const dataUrl = await readFileAsDataUrl(file);
    setSubmitTab("text");
    setPastedImage({ dataUrl, mimeType: file.type });
    setText("");
    setPendingFiles([]);
    setMessage(undefined);
  }

  function clearPastedImage() {
    setPastedImage(undefined);
    setMessage(undefined);
  }

  function switchTab(tab: SubmitTab) {
    setSubmitTab(tab);
    setMessage(undefined);
    if (tab === "files") {
      setText("");
      setPastedImage(undefined);
    } else {
      setPendingFiles([]);
    }
  }

  function dialogTitle() {
    if (submitTab === "files") return "Dokumente hochladen";
    return pastedImage ? "Bild aus Zwischenablage" : "Text erfassen";
  }

  function hintIcon() {
    if (pastedImage) return <ImageIcon size={16} />;
    return submitTab === "files" ? <Upload size={16} /> : <FileText size={16} />;
  }

  function handleFileDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingFiles(true);
  }

  function handleFileDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
  }

  function handleFileDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
  }

  async function handleFileDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
    await addFiles([...event.dataTransfer.files]);
  }

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    await addFiles([...(event.target.files ?? [])]);
    event.target.value = "";
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    const inputs = await Promise.all(files.map(toPendingFile));
    setPendingFiles((current) => [...current, ...inputs]);
    setText("");
    setPastedImage(undefined);
    setSubmitTab("files");
    setMessage(undefined);
  }

  function removePendingFile(id: string) {
    setPendingFiles((current) => current.filter((file) => file.id !== id));
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function toPendingFile(file: File): Promise<PendingFile> {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    dataUrl,
    dataBase64: dataUrl.split(",", 2)[1] ?? "",
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type BookingGroup = {
  date: string;
  bookings: CalendarBooking[];
};

function groupBookingsByDate(bookings: CalendarBooking[]): BookingGroup[] {
  const groups = new Map<string, CalendarBooking[]>();
  for (const booking of [...bookings].sort(compareCalendarBookings)) {
    const date = booking.start.value.slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), booking]);
  }
  return [...groups.entries()].map(([date, groupBookings]) => ({ date, bookings: groupBookings }));
}

function compareCalendarBookings(a: CalendarBooking, b: CalendarBooking): number {
  return startTime(a) - startTime(b) || a.title.localeCompare(b.title);
}

function startTime(booking: CalendarBooking): number {
  const value = booking.start.value;
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatRange(booking: CalendarBooking): string {
  const start = formatDateTime(booking.start.value);
  const end = booking.end ? formatDateTime(booking.end.value) : undefined;
  return end ? `${start} bis ${end}` : start;
}

function formatDateTime(value: string): string {
  const normalized = value.includes("T") ? value : `${value}T12:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  }).format(date);
}
