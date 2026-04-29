import {
  Activity,
  CalendarDays,
  Bus,
  Car,
  ChevronDown,
  ChevronRight,
  FileText,
  FerrisWheel,
  Image as ImageIcon,
  Loader2,
  Plane,
  Plus,
  RefreshCw,
  Ship,
  Send,
  TrainFront,
  Trash2,
  Upload,
  Utensils,
  Warehouse,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarBooking } from "../../domain/model";
import type { ActivityLogEntry } from "../../providers/activity-log/ActivityLogProvider";
import {
  deleteBooking,
  submitDocumentFiles,
  submitDocumentImage,
  submitDocumentText,
  viewActivityLog,
  viewBookingCalendar,
} from "./api";

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

type ActivityLogTableRow =
  | { type: "entry"; entry: ActivityLogEntry }
  | { type: "separator"; id: string; gapMs: number };

export function App() {
  if (window.location.pathname === "/log") {
    return <ActivityLogPage />;
  }

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
  const [expandedBookingIds, setExpandedBookingIds] = useState<Set<string>>(() => new Set());
  const [pendingDeleteBookingId, setPendingDeleteBookingId] = useState<string | undefined>();
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

  async function handleDeleteBooking(bookingExtractedId: string) {
    if (pendingDeleteBookingId !== bookingExtractedId) {
      setPendingDeleteBookingId(bookingExtractedId);
      return;
    }

    setMessage(undefined);
    const response = await deleteBooking(bookingExtractedId);
    if (response.status === "accepted") {
      setPendingDeleteBookingId(undefined);
      setExpandedBookingIds((current) => {
        const next = new Set(current);
        next.delete(bookingExtractedId);
        return next;
      });
      await loadCalendar();
    } else {
      setMessage(response.message);
    }
  }

  const groupedBookings = useMemo(() => groupBookingsByDate(bookings), [bookings]);

  return (
    <main className="appShell" onClick={clearPendingDelete}>
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
                  <article className="bookingCard compact" key={booking.bookingExtractedId}>
                    <div className="bookingCompactRow">
                      <BookingTypeIcon type={booking.type} />
                      <div className="bookingCompactMain">
                        <div className="bookingCompactTime">
                          <strong>{formatStartTime(booking)}</strong>
                          {booking.end ? <span>{formatEndTime(booking)}</span> : null}
                        </div>
                        <h2>{bookingPrimary(booking)}</h2>
                        {bookingSecondary(booking) ? <div className="bookingSecondary">{bookingSecondary(booking)}</div> : null}
                      </div>
                      {booking.travelers.length > 0 ? <TravelerBadges travelers={booking.travelers} /> : null}
                      <span className="statusPill">{booking.status === "needs_review" ? "Review" : booking.status}</span>
                      <button
                        className={pendingDeleteBookingId === booking.bookingExtractedId ? "deleteButton confirm" : "deleteButton"}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteBooking(booking.bookingExtractedId);
                        }}
                        title={pendingDeleteBookingId === booking.bookingExtractedId ? "Löschen bestätigen" : "Buchung löschen"}
                      >
                        {pendingDeleteBookingId === booking.bookingExtractedId ? "?" : <Trash2 size={16} />}
                      </button>
                      <button
                        className="expandButton"
                        type="button"
                        onClick={() => toggleBookingExpanded(booking.bookingExtractedId)}
                        title={expandedBookingIds.has(booking.bookingExtractedId) ? "Einklappen" : "Aufklappen"}
                      >
                        {expandedBookingIds.has(booking.bookingExtractedId) ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </button>
                    </div>
                    {expandedBookingIds.has(booking.bookingExtractedId) ? (
                      <div className="bookingExpanded">
                        <div className="routeLine">
                          <span>{booking.from?.name ?? "Start offen"}</span>
                          <span className="arrow">→</span>
                          <span>{booking.to?.name ?? "Ziel offen"}</span>
                        </div>
                        {booking.travelers.length > 0 ? (
                          <div className="travelers">{booking.travelers.join(", ")}</div>
                        ) : null}
                        <pre className="details">{booking.details}</pre>
                        {booking.sourceDocument ? (
                          <a
                            className="documentLink"
                            href={`/api/documents/${booking.sourceDocument.documentFileUploadedId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Originaldokument öffnen: {booking.sourceDocument.originalFileName}
                          </a>
                        ) : null}
                        <div className="processedAt">Verarbeitet: {formatProcessedAt(booking.processedAt)}</div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </section>

      <div className="logLinkWrap">
        <a href="/log" target="_blank" rel="noreferrer">
          Log
        </a>
      </div>

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

  function toggleBookingExpanded(id: string) {
    setExpandedBookingIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearPendingDelete() {
    if (pendingDeleteBookingId) {
      setPendingDeleteBookingId(undefined);
    }
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

function BookingTypeIcon({ type }: { type: CalendarBooking["type"] }) {
  const config = bookingTypeIconConfig[type] ?? bookingTypeIconConfig.other;
  const Icon = config.icon;
  return (
    <span className="bookingTypeIcon" style={{ color: config.color, backgroundColor: config.background }} title={config.label}>
      <Icon size={22} strokeWidth={2.4} />
    </span>
  );
}

function ActivityLogPage() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | undefined>();

  async function loadLog() {
    setIsLoading(true);
    setMessage(undefined);
    try {
      const response = await viewActivityLog();
      setEntries(response.entries);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Log konnte nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLog();
  }, []);

  const rows = useMemo(() => withBatchSeparators(entries), [entries]);

  return (
    <main className="appShell logShell">
      <header className="topBar">
        <div>
          <div className="eyebrow">TripCal</div>
          <h1>Log</h1>
        </div>
        <div className="toolbar">
          <a className="secondaryLinkButton" href="/">
            Kalender
          </a>
          <button className="iconButton" type="button" onClick={loadLog} title="Log aktualisieren">
            {isLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
        </div>
      </header>

      {message ? <div className="notice">{message}</div> : null}

      <section className="logSurface" aria-label="Activity Log">
        {isLoading ? (
          <div className="emptyState">
            <Loader2 className="spin" size={24} />
            Log wird geladen
          </div>
        ) : rows.length === 0 ? (
          <div className="emptyState">Keine Logeinträge vorhanden.</div>
        ) : (
          <table className="logTable">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Level</th>
                <th>Scope</th>
                <th>Meldung</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.type === "separator" ? (
                  <tr className="batchSeparator" key={row.id}>
                    <td colSpan={5}>Batchwechsel · Abstand {formatDuration(row.gapMs)}</td>
                  </tr>
                ) : (
                  <tr key={row.entry.id}>
                    <td className="logTime">{formatLogTime(row.entry.timestamp)}</td>
                    <td>
                      <span className={`logLevel ${row.entry.level}`}>{row.entry.level}</span>
                    </td>
                    <td className="logScope">{row.entry.scope}</td>
                    <td className="logMessage">{row.entry.message}</td>
                    <td>
                      <pre className="logDetails">{formatLogDetails(row.entry.details)}</pre>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function TravelerBadges({ travelers }: { travelers: string[] }) {
  return (
    <div className="travelerBadges" aria-label="Reisende">
      {travelers.map((traveler) => (
        <span className="travelerBadge" key={traveler} title={traveler} style={travelerBadgeStyle(traveler)}>
          {traveler}
        </span>
      ))}
    </div>
  );
}

function travelerBadgeStyle(traveler: string) {
  const palette = travelerPalette[traveler] ?? fallbackTravelerPalette[hashString(traveler) % fallbackTravelerPalette.length];
  return {
    backgroundColor: palette.background,
    color: palette.text,
  };
}

const travelerPalette: Record<string, { background: string; text: string }> = {
  RW: { background: "#2563a9", text: "#ffffff" },
  AK: { background: "#b32958", text: "#ffffff" },
};

const fallbackTravelerPalette = [
  { background: "#16824b", text: "#ffffff" },
  { background: "#7c3f9d", text: "#ffffff" },
  { background: "#087487", text: "#ffffff" },
  { background: "#8a4f00", text: "#ffffff" },
];

function hashString(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

const bookingTypeIconConfig: Record<
  CalendarBooking["type"],
  {
    icon: LucideIcon;
    label: string;
    color: string;
    background: string;
  }
> = {
  flight: {
    icon: Plane,
    label: "Flug",
    color: "#16824b",
    background: "#e7f5ee",
  },
  accommodation: {
    icon: Warehouse,
    label: "Unterkunft",
    color: "#2563a9",
    background: "#e9f1fb",
  },
  train: {
    icon: TrainFront,
    label: "Zug",
    color: "#8a4f00",
    background: "#fff1dc",
  },
  bus: {
    icon: Bus,
    label: "Bus",
    color: "#7c3f9d",
    background: "#f3e9fb",
  },
  ferry: {
    icon: Ship,
    label: "Fähre",
    color: "#087487",
    background: "#e4f6f8",
  },
  car: {
    icon: Car,
    label: "Auto",
    color: "#48525c",
    background: "#edf0f2",
  },
  event: {
    icon: FerrisWheel,
    label: "Event",
    color: "#b32958",
    background: "#fde8ef",
  },
  restaurant: {
    icon: Utensils,
    label: "Restaurant",
    color: "#9a3b1e",
    background: "#fdeee8",
  },
  activity: {
    icon: Activity,
    label: "Aktivität",
    color: "#647100",
    background: "#f2f5d9",
  },
  other: {
    icon: FileText,
    label: "Sonstiges",
    color: "#5b6f6a",
    background: "#edf2f0",
  },
};

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

function bookingPrimary(booking: CalendarBooking): string {
  if (isTransportBooking(booking)) {
    const route = formatRoute(booking);
    return [booking.serviceIdentifier, route || booking.title].filter(Boolean).join(" · ");
  }

  if (booking.type === "accommodation") {
    return booking.to?.name ?? booking.from?.name ?? booking.title;
  }

  return booking.title;
}

function bookingSecondary(booking: CalendarBooking): string | undefined {
  if (isTransportBooking(booking)) {
    return booking.operator;
  }

  if (booking.type === "accommodation") {
    return formatPlace(booking.to ?? booking.from);
  }

  if (booking.type === "restaurant" || booking.type === "event" || booking.type === "activity") {
    return formatPlace(booking.to ?? booking.from) ?? booking.operator;
  }

  return formatPlace(booking.to ?? booking.from) ?? booking.operator;
}

function isTransportBooking(booking: CalendarBooking): boolean {
  return ["flight", "train", "bus", "ferry"].includes(booking.type);
}

function formatRoute(booking: CalendarBooking): string | undefined {
  if (!booking.from?.name && !booking.to?.name) return undefined;
  return `${booking.from?.name ?? "Start offen"} → ${booking.to?.name ?? "Ziel offen"}`;
}

function formatPlace(place: CalendarBooking["from"]): string | undefined {
  if (!place) return undefined;
  return [place.name, place.city, place.country].filter(Boolean).join(", ");
}

function formatStartTime(booking: CalendarBooking): string {
  return formatTime(booking.start.value);
}

function formatEndTime(booking: CalendarBooking): string {
  if (!booking.end) return "";
  const sameDay = booking.start.value.slice(0, 10) === booking.end.value.slice(0, 10);
  return sameDay ? formatTime(booking.end.value) : formatDateTime(booking.end.value);
}

function formatProcessedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function withBatchSeparators(entries: ActivityLogEntry[]): ActivityLogTableRow[] {
  const rows: ActivityLogTableRow[] = [];
  const batchGapMs = 60_000;

  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    if (previous) {
      const gapMs = Math.abs(new Date(previous.timestamp).getTime() - new Date(entry.timestamp).getTime());
      if (Number.isFinite(gapMs) && gapMs >= batchGapMs) {
        rows.push({ type: "separator", id: `${previous.id}-${entry.id}`, gapMs });
      }
    }
    rows.push({ type: "entry", entry });
  });

  return rows;
}

function formatLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatLogDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return "";
  return JSON.stringify(details, null, 2);
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 120) return `${seconds} Sekunden`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 120) return `${minutes} Minuten`;
  return `${Math.round(minutes / 60)} Stunden`;
}

function formatTime(value: string): string {
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value.includes("T") ? value.slice(11, 16) : "";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
