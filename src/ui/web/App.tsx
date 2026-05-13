import {
  Activity,
  ArrowRight,
  CalendarDays,
  Bus,
  Car,
  ChevronDown,
  ChevronRight,
  FileText,
  FerrisWheel,
  Image as ImageIcon,
  Info,
  Loader2,
  Pencil,
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
import type {
  BookingCorrectionPatch,
  BookingDateTime,
  BookingPlace,
  BookingStatus,
  BookingType,
  CalendarBooking,
  Trip,
} from "../../domain/model";
import type { ActivityLogEntry } from "../../providers/activity-log/ActivityLogProvider";
import {
  assignBookingToTrip,
  changeBookingStatus,
  correctBooking,
  correctTrip,
  createTrip,
  deleteBooking,
  submitDocumentFiles,
  submitDocumentImage,
  submitDocumentText,
  viewActivityLog,
  viewBookingCalendar,
  viewTrips,
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
type CalendarFilterMode = "traveler" | "trip";
type MainView = "calendar" | "reports";

type ActivityLogTableRow =
  | { type: "entry"; entry: ActivityLogEntry }
  | { type: "separator"; id: string; gapMs: number };

type BookingEditForm = {
  title: string;
  type: BookingType;
  serviceIdentifier: string;
  operator: string;
  startValue: string;
  startTimezone: string;
  endValue: string;
  endTimezone: string;
  fromText: string;
  toText: string;
  travelers: string[];
  details: string;
};

type ViewedDocument = {
  documentFileUploadedId: string;
  originalFileName: string;
};

export function App() {
  if (window.location.pathname === "/log") {
    return <ActivityLogPage />;
  }

  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [travelerLabels, setTravelerLabels] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [pastedImage, setPastedImage] = useState<PastedImage | undefined>();
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [submitTab, setSubmitTab] = useState<SubmitTab>("files");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showTripDialog, setShowTripDialog] = useState(false);
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | undefined>();
  const [editingBooking, setEditingBooking] = useState<CalendarBooking | undefined>();
  const [bookingEditForm, setBookingEditForm] = useState<BookingEditForm | undefined>();
  const [viewingDocument, setViewingDocument] = useState<ViewedDocument | undefined>();
  const [isCorrectingBooking, setIsCorrectingBooking] = useState(false);
  const [tripForm, setTripForm] = useState({
    shortCode: "",
    title: "",
    owner: "",
    startDate: "",
    endDate: "",
  });
  const [message, setMessage] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [activeMainView, setActiveMainView] = useState<MainView>("calendar");
  const [calendarFilterMode, setCalendarFilterMode] = useState<CalendarFilterMode>("traveler");
  const [selectedTravelerFilters, setSelectedTravelerFilters] = useState<string[]>([]);
  const [selectedTripFilter, setSelectedTripFilter] = useState<string | undefined>();
  const [expandedBookingIds, setExpandedBookingIds] = useState<Set<string>>(() => new Set());
  const [expandedReportTripIds, setExpandedReportTripIds] = useState<Set<string>>(() => new Set());
  const [pendingDeleteBookingId, setPendingDeleteBookingId] = useState<string | undefined>();
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadCalendar() {
    setIsLoadingCalendar(true);
    try {
      const [calendarResponse, tripsResponse] = await Promise.all([viewBookingCalendar(), viewTrips()]);
      setBookings(calendarResponse.bookings);
      setTrips(tripsResponse.trips);
      setTravelerLabels(tripsResponse.travelerLabels);
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
    const validationMessage = validateSubmitDialog({ pendingFiles, pastedImage, text, submitTab });
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage(undefined);
    setFormError(undefined);
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
        setFormError(response.message);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unerwarteter Fehler.");
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

  function openTripDialog() {
    setEditingTrip(undefined);
    setTripForm({ shortCode: "", title: "", owner: "", startDate: "", endDate: "" });
    setFormError(undefined);
    setShowTripDialog(true);
  }

  function openTripEditDialog(trip: Trip) {
    setEditingTrip(trip);
    setTripForm({
      shortCode: trip.shortCode,
      title: trip.title ?? "",
      owner: trip.owner,
      startDate: trip.startDate,
      endDate: trip.endDate,
    });
    setFormError(undefined);
    setShowTripDialog(true);
  }

  async function handleSaveTrip() {
    const validationMessage = validateTripForm(tripForm);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setIsSavingTrip(true);
    setMessage(undefined);
    setFormError(undefined);
    try {
      const payload = {
        shortCode: tripForm.shortCode,
        title: tripForm.title || undefined,
        owner: tripForm.owner,
        startDate: tripForm.startDate,
        endDate: tripForm.endDate,
      };
      const response = editingTrip
        ? await correctTrip({ tripCreatedId: editingTrip.tripCreatedId, ...payload })
        : await createTrip(payload);
      if (response.status === "failed") {
        setFormError(tripSaveMessage(response.reason));
        return;
      }
      setShowTripDialog(false);
      setEditingTrip(undefined);
      await loadCalendar();
    } finally {
      setIsSavingTrip(false);
    }
  }

  async function handleAssignTrip(bookingExtractedId: string, tripCreatedId: string) {
    if (!tripCreatedId) return;
    const response = await assignBookingToTrip(bookingExtractedId, tripCreatedId);
    if (response.status === "failed") {
      setMessage("Trip konnte nicht zugeordnet werden.");
      return;
    }
    await loadCalendar();
  }

  async function handleChangeBookingStatus(bookingExtractedId: string, status: BookingStatus) {
    const response = await changeBookingStatus(bookingExtractedId, status);
    if (response.status === "rejected") {
      setMessage(response.message);
      return;
    }
    await loadCalendar();
  }

  function openBookingEditor(booking: CalendarBooking) {
    setEditingBooking(booking);
    setBookingEditForm(toBookingEditForm(booking));
    setFormError(undefined);
    setMessage(undefined);
  }

  async function handleCorrectBooking() {
    if (!editingBooking || !bookingEditForm) return;
    const validationMessage = validateBookingEditForm(bookingEditForm);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setIsCorrectingBooking(true);
    setMessage(undefined);
    setFormError(undefined);
    try {
      const patch = buildBookingCorrectionPatch(editingBooking, bookingEditForm);
      const response = await correctBooking(editingBooking.bookingExtractedId, patch);
      if (response.status === "rejected") {
        setFormError(response.message);
        return;
      }
      setEditingBooking(undefined);
      setBookingEditForm(undefined);
      await loadCalendar();
    } finally {
      setIsCorrectingBooking(false);
    }
  }

  function toggleTravelerFilter(traveler: string) {
    setSelectedTripFilter(undefined);
    setSelectedTravelerFilters((current) =>
      current.includes(traveler) ? current.filter((entry) => entry !== traveler) : [...current, traveler],
    );
  }

  function setFilterMode(mode: CalendarFilterMode) {
    setCalendarFilterMode(mode);
    if (mode === "traveler") {
      setSelectedTripFilter(undefined);
    } else {
      setSelectedTravelerFilters([]);
    }
  }

  function selectTripFilter(tripCreatedId: string) {
    setSelectedTravelerFilters([]);
    setSelectedTripFilter((current) => (current === tripCreatedId ? undefined : tripCreatedId));
  }

  function clearCalendarFilters() {
    setSelectedTravelerFilters([]);
    setSelectedTripFilter(undefined);
  }

  function toggleReportTripExpanded(id: string) {
    setExpandedReportTripIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const filteredBookings = useMemo(
    () => filterBookings(bookings, {
      mode: calendarFilterMode,
      selectedTravelers: selectedTravelerFilters,
      selectedTrip: selectedTripFilter,
    }),
    [bookings, calendarFilterMode, selectedTravelerFilters, selectedTripFilter],
  );
  const groupedBookings = useMemo(() => groupBookingsByDate(filteredBookings), [filteredBookings]);
  const bookingEditTravelerLabels = useMemo(
    () => [...new Set([...travelerLabels, ...(bookingEditForm?.travelers ?? [])])].sort(),
    [travelerLabels, bookingEditForm?.travelers],
  );

  return (
    <main className="appShell" onClick={clearPendingDelete}>
      <header className="topBar">
        <div>
          <div className="eyebrow">TripCal</div>
          <h1>{activeMainView === "calendar" ? "Buchungskalender" : "Trip Reports"}</h1>
        </div>
        <div className="toolbar">
          <nav className="mainNav" aria-label="Hauptansicht">
            <button
              className={activeMainView === "calendar" ? "mainNavButton active" : "mainNavButton"}
              type="button"
              onClick={() => setActiveMainView("calendar")}
            >
              Kalender
            </button>
            <button
              className={activeMainView === "reports" ? "mainNavButton active" : "mainNavButton"}
              type="button"
              onClick={() => setActiveMainView("reports")}
            >
              Reports
            </button>
          </nav>
          <button className="iconButton" type="button" onClick={loadCalendar} title="Kalender aktualisieren">
            {isLoadingCalendar ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
          {activeMainView === "calendar" ? (
            <button className="primaryButton" type="button" onClick={openSubmitDialog}>
              <Plus size={18} />
              Dokument
            </button>
          ) : null}
        </div>
      </header>

      {message ? <div className="notice">{message}</div> : null}

      {activeMainView === "calendar" ? (
      <section className="calendarLayout" aria-label="Buchungskalender">
        <aside className="tripSidebar" aria-label="Trips">
          <div className="tripSidebarHeader">
            <span>Trips</span>
            <button className="tripAddButton" type="button" onClick={openTripDialog} title="Trip anlegen">
              <Plus size={16} />
            </button>
          </div>
          <div className="tripList">
            {trips.length === 0 ? (
              <div className="tripEmpty">Keine Trips</div>
            ) : (
              trips.map((trip) => (
                <div className="tripListItem" key={trip.tripCreatedId} style={{ borderLeftColor: trip.color }}>
                  <div className="tripListTop">
                    <span className="tripListTitle">
                      <strong>{trip.shortCode}</strong>
                      <span className="tripListNumber">#{trip.tripNumber}</span>
                    </span>
                    <span className="tripListActions">
                      <span className="travelerBadge tripOwnerBadge" title={trip.owner} style={travelerBadgeStyle(trip.owner)}>
                        {trip.owner}
                      </span>
                      <button className="tripEditButton" type="button" onClick={() => openTripEditDialog(trip)} title="Trip bearbeiten">
                        <Pencil size={14} />
                      </button>
                    </span>
                  </div>
                  <div className="tripListDates">
                    {formatShortDate(trip.startDate)} - {formatShortDate(trip.endDate)}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <div className="calendarSurface">
          <div className="calendarFilters" aria-label="Kalenderfilter">
            <div className="filterModeGroup">
              <span>Filter:</span>
              <button
                className={calendarFilterMode === "traveler" ? "filterModeButton active" : "filterModeButton"}
                type="button"
                onClick={() => setFilterMode("traveler")}
              >
                Reisender
              </button>
              <button
                className={calendarFilterMode === "trip" ? "filterModeButton active" : "filterModeButton"}
                type="button"
                onClick={() => setFilterMode("trip")}
              >
                Trip
              </button>
            </div>

            <div className="filterCriteria">
              {calendarFilterMode === "traveler" ? travelerLabels.map((traveler) => (
                <button
                  className={
                    selectedTravelerFilters.includes(traveler) ? "travelerFilterButton selected" : "travelerFilterButton"
                  }
                  type="button"
                  key={traveler}
                  onClick={() => toggleTravelerFilter(traveler)}
                  aria-pressed={selectedTravelerFilters.includes(traveler)}
                  title={
                    selectedTravelerFilters.includes(traveler)
                      ? `${traveler}-Filter entfernen`
                      : `Nur Buchungen für ${traveler} anzeigen`
                  }
                >
                  <span className="travelerBadge" style={travelerBadgeStyle(traveler)}>
                    {traveler}
                  </span>
                </button>
              )) : trips.map((trip) => (
                <button
                  className={selectedTripFilter === trip.tripCreatedId ? "tripFilterChip selected" : "tripFilterChip"}
                  type="button"
                  key={trip.tripCreatedId}
                  onClick={() => selectTripFilter(trip.tripCreatedId)}
                  aria-pressed={selectedTripFilter === trip.tripCreatedId}
                  title={
                    selectedTripFilter === trip.tripCreatedId
                      ? `${trip.shortCode}-Filter entfernen`
                      : `Nur Buchungen im Trip ${trip.shortCode} anzeigen`
                  }
                  style={{ borderColor: selectedTripFilter === trip.tripCreatedId ? trip.color : undefined }}
                >
                  <span className="tripFilterDot" style={{ backgroundColor: trip.color }} />
                  {trip.shortCode}
                </button>
              ))}
              {selectedTravelerFilters.length > 0 || selectedTripFilter ? (
                <button className="clearFilterButton" type="button" onClick={clearCalendarFilters} title="Filter zurücksetzen">
                  <X size={15} />
                </button>
              ) : null}
            </div>
          </div>
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
          ) : filteredBookings.length === 0 ? (
            <div className="emptyState">
              <CalendarDays size={28} />
              <span>Keine Buchungen für diesen Filter.</span>
            </div>
          ) : (
            groupedBookings.map((group, index) => (
              <div className="calendarDayWithGap" key={group.date}>
                {index > 0 ? (
                  <GapBar
                    previousDate={groupedBookings[index - 1].date}
                    nextDate={group.date}
                  />
                ) : null}
                <section className="dayGroup">
                  <div className="dateRail">
                    <span>{formatDate(group.date)}</span>
                  </div>
                  <div className="bookingList">
                    {group.bookings.map((booking) => (
                  <article
                    className={booking.trip ? "bookingCard compact hasTrip" : "bookingCard compact"}
                    key={booking.bookingExtractedId}
                    style={booking.trip ? { borderLeftColor: booking.trip.color } : undefined}
                  >
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
                      <div className="bookingCompactControls">
                        {booking.travelers.length > 0 ? <TravelerBadges travelers={booking.travelers} /> : null}
                        {booking.trip ? <TripChip trip={booking.trip} /> : null}
                        {booking.status === "inbox" ? <span className="statusPill">Inbox</span> : null}
                        <button
                          className="editButton"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openBookingEditor(booking);
                          }}
                          title="Buchung bearbeiten"
                        >
                          <Pencil size={16} />
                        </button>
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
                          <button
                            className="documentLink"
                            type="button"
                            onClick={() => setViewingDocument(booking.sourceDocument)}
                          >
                            Originaldokument: {booking.sourceDocument.originalFileName}
                          </button>
                        ) : null}
                        <div className="bookingExpandedControls">
                          <label className="tripAssignControl">
                            <span>Trip</span>
                            <select
                              value={booking.trip?.tripCreatedId ?? ""}
                              onChange={(event) => void handleAssignTrip(booking.bookingExtractedId, event.target.value)}
                            >
                              <option value="">Nicht zugeordnet</option>
                              {trips.map((trip) => (
                                <option value={trip.tripCreatedId} key={trip.tripCreatedId}>
                                  {trip.shortCode}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="tripAssignControl">
                            <span>Status</span>
                            <select
                              value={booking.status}
                              onChange={(event) =>
                                void handleChangeBookingStatus(booking.bookingExtractedId, event.target.value as BookingStatus)
                              }
                            >
                              <option value="inbox">Inbox</option>
                              <option value="reviewed">Reviewed</option>
                            </select>
                          </label>
                        </div>
                        <div className="processedAt">Verarbeitet: {formatProcessedAt(booking.processedAt)}</div>
                      </div>
                    ) : null}
                    </article>
                    ))}
                  </div>
                </section>
              </div>
            ))
          )}
        </div>
      </section>
      ) : (
        <TripReportsView
          trips={trips}
          isLoading={isLoadingCalendar}
          expandedTripIds={expandedReportTripIds}
          onToggleTrip={toggleReportTripExpanded}
        />
      )}

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
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={handleFileInputChange} />
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
              <div>
                <div className="hint">
                  {hintIcon()}
                  {pastedImage
                    ? "Das Bild wird nur zur Texterkennung verwendet und nicht gespeichert."
                    : submitTab === "files"
                      ? "Dateien werden lokal gespeichert; PDF- und Bilddateien können per KI ausgelesen werden."
                      : "Text direkt erfassen, einfügen oder mehrere Buchungen mit --- trennen."}
                </div>
                {formError ? <div className="formError">{formError}</div> : null}
              </div>
              <button className="primaryButton" type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                Einreichen
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {showTripDialog ? (
        <div className="dialogBackdrop blur" role="presentation">
          <section className="dialog tripDialog" aria-label={editingTrip ? "Trip bearbeiten" : "Trip anlegen"}>
            <header className="dialogHeader">
              <div>
                <div className="eyebrow">Trip</div>
                <h2>{editingTrip ? "Trip bearbeiten" : "Trip anlegen"}</h2>
              </div>
              <button
                className="iconButton"
                type="button"
                onClick={() => {
                  setShowTripDialog(false);
                  setEditingTrip(undefined);
                }}
                title="Schließen"
              >
                <X size={18} />
              </button>
            </header>
            <div className="tripForm">
              <label>
                <span>Kürzel *</span>
                <input
                  required
                  value={tripForm.shortCode}
                  onChange={(event) => setTripForm((form) => ({ ...form, shortCode: event.target.value }))}
                  placeholder="Kürzel"
                />
              </label>
              <label>
                <span>Titel</span>
                <input
                  value={tripForm.title}
                  onChange={(event) => setTripForm((form) => ({ ...form, title: event.target.value }))}
                  placeholder="Titel"
                />
              </label>
              <label>
                <span>Owner *</span>
                <select
                  required
                  value={tripForm.owner}
                  onChange={(event) => setTripForm((form) => ({ ...form, owner: event.target.value }))}
                >
                  <option value="" disabled>
                    {travelerLabels.length === 0 ? "Keine Traveller konfiguriert" : "Owner auswählen"}
                  </option>
                  {travelerLabels.map((label) => (
                    <option value={label} key={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="tripDateRow">
                <label>
                  <span>Von *</span>
                  <input
                    required
                    type="date"
                    value={tripForm.startDate}
                    onChange={(event) => setTripForm((form) => ({ ...form, startDate: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Bis *</span>
                  <input
                    required
                    type="date"
                    value={tripForm.endDate}
                    onChange={(event) => setTripForm((form) => ({ ...form, endDate: event.target.value }))}
                  />
                </label>
              </div>
            </div>
            <footer className="dialogFooter">
              <div>
                <div className="hint">
                  {editingTrip
                    ? "Bestehende Buchungszuordnungen bleiben unverändert."
                    : "Tripnummer und Farbe werden automatisch vergeben."}
                </div>
                {formError ? <div className="formError">{formError}</div> : null}
              </div>
              <button className="primaryButton" type="button" onClick={handleSaveTrip} disabled={isSavingTrip}>
                {isSavingTrip ? <Loader2 className="spin" size={18} /> : editingTrip ? <Pencil size={18} /> : <Plus size={18} />}
                {editingTrip ? "Speichern" : "Anlegen"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {editingBooking && bookingEditForm ? (
        <div className="dialogBackdrop blur" role="presentation">
          <section className="dialog bookingEditDialog" aria-label="Buchung bearbeiten">
            <header className="dialogHeader">
              <div>
                <div className="eyebrow">Buchung</div>
                <h2>Buchung bearbeiten</h2>
              </div>
              <button
                className="iconButton"
                type="button"
                onClick={() => {
                  setEditingBooking(undefined);
                  setBookingEditForm(undefined);
                }}
                title="Schließen"
              >
                <X size={18} />
              </button>
            </header>

            <div className="bookingEditForm">
              <label className="fullSpan">
                <span>Titel</span>
                <input
                  required
                  value={bookingEditForm.title}
                  onChange={(event) => setBookingEditForm((form) => form && { ...form, title: event.target.value })}
                />
              </label>
              <label>
                <span>Art</span>
                <select
                  value={bookingEditForm.type}
                  onChange={(event) =>
                    setBookingEditForm((form) => form && { ...form, type: event.target.value as BookingType })
                  }
                >
                  {bookingTypeOptions.map((type) => (
                    <option value={type} key={type}>
                      {bookingTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="fieldLabel">
                  Kennung
                  <span
                    className="infoTooltip"
                    title="Konkrete Leistungskennung, z.B. Flugnummer QR971, Zugnummer ICE 579, Buslinie oder Fährverbindung."
                  >
                    <Info size={13} />
                  </span>
                </span>
                <input
                  value={bookingEditForm.serviceIdentifier}
                  onChange={(event) =>
                    setBookingEditForm((form) => form && { ...form, serviceIdentifier: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="fieldLabel">
                  Anbieter
                  <span
                    className="infoTooltip"
                    title="Der Betreiber oder Verkäufer der Leistung, z.B. Qatar Airways, Deutsche Bahn, Airbnb, Hotelname oder Theater."
                  >
                    <Info size={13} />
                  </span>
                </span>
                <input
                  value={bookingEditForm.operator}
                  onChange={(event) => setBookingEditForm((form) => form && { ...form, operator: event.target.value })}
                />
              </label>

              <div className="fullSpan timeEditRow">
                <fieldset>
                  <legend>Start</legend>
                  <input
                    required
                    type="datetime-local"
                    value={bookingEditForm.startValue}
                    onChange={(event) => setBookingEditForm((form) => form && { ...form, startValue: event.target.value })}
                  />
                  <select
                    value={bookingEditForm.startTimezone}
                    onChange={(event) =>
                      setBookingEditForm((form) => form && { ...form, startTimezone: event.target.value })
                    }
                  >
                    {timezoneOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </fieldset>

                <button
                  className="copyTimeButton"
                  type="button"
                  title="Start und Zeitzone nach Ende übernehmen"
                  onClick={() =>
                    setBookingEditForm(
                      (form) =>
                        form && {
                          ...form,
                          endValue: form.startValue,
                          endTimezone: form.startTimezone,
                        },
                    )
                  }
                >
                  <ArrowRight size={16} />
                </button>

                <fieldset>
                  <legend>Ende</legend>
                  <input
                    type="datetime-local"
                    value={bookingEditForm.endValue}
                    onChange={(event) => setBookingEditForm((form) => form && { ...form, endValue: event.target.value })}
                  />
                  <select
                    value={bookingEditForm.endTimezone}
                    onChange={(event) => setBookingEditForm((form) => form && { ...form, endTimezone: event.target.value })}
                  >
                    {timezoneOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </fieldset>
              </div>

              <label>
                <span>Von</span>
                <input
                  value={bookingEditForm.fromText}
                  onChange={(event) => setBookingEditForm((form) => form && { ...form, fromText: event.target.value })}
                  placeholder="Startort, Adresse, Flughafen, Bahnhof ..."
                />
              </label>

              <label>
                <span>Nach</span>
                <input
                  value={bookingEditForm.toText}
                  onChange={(event) => setBookingEditForm((form) => form && { ...form, toText: event.target.value })}
                  placeholder="Zielort, Adresse, Unterkunft, Veranstaltungsort ..."
                />
              </label>

              <div className="fullSpan travelerCheckList">
                <span>Reisende</span>
                <div>
                  {bookingEditTravelerLabels.map((label) => (
                    <button
                      className={
                        bookingEditForm.travelers.includes(label) ? "travelerSelectButton selected" : "travelerSelectButton"
                      }
                      type="button"
                      key={label}
                      onClick={() =>
                        setBookingEditForm((form) =>
                          form && toggleTravelerInForm(form, label, !form.travelers.includes(label)),
                        )
                      }
                      title={label}
                    >
                      <input
                        type="checkbox"
                        tabIndex={-1}
                        checked={bookingEditForm.travelers.includes(label)}
                        readOnly
                      />
                      <span className="travelerBadge" style={travelerBadgeStyle(label)}>
                        {label}
                      </span>
                    </button>
                  ))}
                  {bookingEditTravelerLabels.length === 0 ? <span className="emptyInline">Keine Reisenden konfiguriert.</span> : null}
                </div>
              </div>

              <label className="fullSpan">
                <span>Details</span>
                <textarea
                  value={bookingEditForm.details}
                  onChange={(event) => setBookingEditForm((form) => form && { ...form, details: event.target.value })}
                />
              </label>
            </div>

            <footer className="dialogFooter bookingEditFooter">
              <div>
                <div className="hint">Gespeichert werden nur geänderte Felder.</div>
                {formError ? <div className="formError">{formError}</div> : null}
              </div>
              <button className="primaryButton" type="button" onClick={handleCorrectBooking} disabled={isCorrectingBooking}>
                {isCorrectingBooking ? <Loader2 className="spin" size={18} /> : <Pencil size={18} />}
                Speichern
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {viewingDocument ? (
        <DocumentViewerOverlay document={viewingDocument} onClose={() => setViewingDocument(undefined)} />
      ) : null}
    </main>
  );

  function openSubmitDialog() {
    setText("");
    setPastedImage(undefined);
    setPendingFiles([]);
    setSubmitTab("files");
    setIsDraggingFiles(false);
    setFormError(undefined);
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
    setFormError(undefined);
    setMessage(undefined);
  }

  function clearPastedImage() {
    setPastedImage(undefined);
    setFormError(undefined);
    setMessage(undefined);
  }

  function switchTab(tab: SubmitTab) {
    setSubmitTab(tab);
    setFormError(undefined);
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
    const acceptedFiles = files.filter((file) => isSupportedUploadFile(file.name));
    const rejectedFiles = files.filter((file) => !isSupportedUploadFile(file.name));
    if (rejectedFiles.length > 0) {
      setFormError(`Nur PDF-Dateien können hochgeladen werden: ${rejectedFiles.map((file) => file.name).join(", ")}`);
    } else {
      setFormError(undefined);
    }
    if (acceptedFiles.length === 0) return;

    const inputs = await Promise.all(acceptedFiles.map(toPendingFile));
    setPendingFiles((current) => [...current, ...inputs]);
    setText("");
    setPastedImage(undefined);
    setSubmitTab("files");
    setMessage(undefined);
  }

  function removePendingFile(id: string) {
    setPendingFiles((current) => current.filter((file) => file.id !== id));
    setFormError(undefined);
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

function DocumentViewerOverlay({ document, onClose }: { document: ViewedDocument; onClose: () => void }) {
  const documentUrl = `/api/documents/${encodeURIComponent(document.documentFileUploadedId)}`;

  return (
    <div className="dialogBackdrop documentViewerBackdrop" onClick={onClose}>
      <section className="documentViewerDialog" aria-label="Originaldokument" onClick={(event) => event.stopPropagation()}>
        <header className="documentViewerHeader">
          <div>
            <div className="eyebrow">Originaldokument</div>
            <h2>{document.originalFileName}</h2>
          </div>
          <button className="iconButton" type="button" onClick={onClose} title="Dokument schließen">
            <X size={18} />
          </button>
        </header>
        <div className="documentViewerSurface">
          <iframe title={document.originalFileName} src={documentUrl} className="documentViewerFrame" />
        </div>
      </section>
    </div>
  );
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

function isSupportedUploadFile(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith(".pdf");
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

function bookingTypeLabel(type: BookingType): string {
  return bookingTypeIconConfig[type]?.label ?? type;
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
                <th>Dokument</th>
                <th>Scope</th>
                <th>Meldung</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.type === "separator" ? (
                  <tr className="batchSeparator" key={row.id}>
                    <td colSpan={6}>Batchwechsel · Abstand {formatDuration(row.gapMs)}</td>
                  </tr>
                ) : (
                  <tr key={row.entry.id}>
                    <td className="logTime">{formatLogTime(row.entry.timestamp)}</td>
                    <td>
                      <span className={`logLevel ${row.entry.level}`}>{row.entry.level}</span>
                    </td>
                    <td className="logDocument">{formatLogDocument(row.entry)}</td>
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

function TripReportsView({
  trips,
  isLoading,
  expandedTripIds,
  onToggleTrip,
}: {
  trips: Trip[];
  isLoading: boolean;
  expandedTripIds: Set<string>;
  onToggleTrip: (tripCreatedId: string) => void;
}) {
  if (isLoading) {
    return (
      <section className="reportSurface" aria-label="Trip Reports">
        <div className="emptyState">
          <Loader2 className="spin" size={24} />
          Reports werden geladen
        </div>
      </section>
    );
  }

  if (trips.length === 0) {
    return (
      <section className="reportSurface" aria-label="Trip Reports">
        <div className="emptyState">
          <CalendarDays size={28} />
          <span>Noch keine Trips angelegt.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="reportSurface" aria-label="Trip Reports">
      <div className="reportTripList">
        {trips.map((trip) => {
          const isExpanded = expandedTripIds.has(trip.tripCreatedId);
          const days = daysInRange(trip.startDate, trip.endDate);
          return (
            <article className="reportTripCard" key={trip.tripCreatedId} style={{ borderLeftColor: trip.color }}>
              <button
                className="reportTripHeader"
                type="button"
                onClick={() => onToggleTrip(trip.tripCreatedId)}
                aria-expanded={isExpanded}
              >
                <div className="reportTripTitleBlock">
                  <span className="reportTripTitle">
                    <strong>{trip.shortCode}</strong>
                    <span className="reportTripNumber">#{trip.tripNumber}</span>
                    {trip.title ? <span className="reportTripName">{trip.title}</span> : null}
                  </span>
                  <span className="reportTripDates">
                    {formatShortDate(trip.startDate)} - {formatShortDate(trip.endDate)}
                  </span>
                </div>
                <div className="reportTripMeta">
                  <span className="travelerBadge tripOwnerBadge" title={trip.owner} style={travelerBadgeStyle(trip.owner)}>
                    {trip.owner}
                  </span>
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>
              {isExpanded ? (
                <div className="reportTripBody">
                  <div className="reportDayGrid" aria-label={`Tage für Trip ${trip.shortCode}`}>
                    {days.map((day, index) => (
                      <div className="reportDayTile" key={day}>
                        <span className="reportDayMain">
                          <span className="reportDayNumber">{String(index + 1).padStart(2, "0")}</span>
                          <span>{formatReportDay(day)}</span>
                        </span>
                        <span className="reportDayCountry">--</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
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

function TripChip({ trip }: { trip: NonNullable<CalendarBooking["trip"]> }) {
  return (
    <span className="tripChip" style={{ borderColor: trip.color, color: trip.color }}>
      {trip.shortCode}
    </span>
  );
}

function GapBar({
  previousDate,
  nextDate,
}: {
  previousDate: string;
  nextDate: string;
}) {
  const emptyDays = daysBetween(previousDate, nextDate) - 1;

  const normalized = Math.min(1, Math.log1p(emptyDays) / Math.log1p(90));
  const width = emptyDays > 0 ? 28 + normalized * 280 : 0;
  const height = emptyDays > 0 ? 2 + normalized * 8 : 0;

  return (
    <div className="gapBarRow" aria-hidden="true">
      <div />
      <div className="gapBarTrack">
        {emptyDays > 0 ? <div className="gapBar" style={{ width: `${width}px`, height: `${height}px` }} /> : null}
      </div>
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

const bookingTypeOptions: BookingType[] = [
  "flight",
  "accommodation",
  "train",
  "bus",
  "ferry",
  "car",
  "event",
  "restaurant",
  "activity",
  "other",
];

const timezoneOptions = [
  { value: "", label: "Keine Zeitzone" },
  ...Array.from({ length: 25 }, (_, index) => index - 12).map((offset) => ({
    value: offset === 0 ? "+00:00" : `${offset > 0 ? "+" : "-"}${String(Math.abs(offset)).padStart(2, "0")}:00`,
    label: offset === 0 ? "UTC +/-0" : `UTC ${offset > 0 ? "+" : ""}${offset}`,
  })),
];

function validateSubmitDialog(input: {
  pendingFiles: PendingFile[];
  pastedImage: PastedImage | undefined;
  text: string;
  submitTab: SubmitTab;
}): string | undefined {
  if (input.pendingFiles.length > 0 || input.pastedImage) return undefined;
  if (input.text.trim().length > 0) return undefined;
  return input.submitTab === "files"
    ? "Bitte wähle mindestens eine Datei aus oder wechsle zu Text / Clipboard."
    : "Bitte gib einen Dokumenttext ein oder füge ein Bild aus der Zwischenablage ein.";
}

function validateTripForm(form: { shortCode: string; owner: string; startDate: string; endDate: string }): string | undefined {
  if (!form.shortCode.trim()) return "Bitte gib ein Trip-Kürzel ein.";
  if (!form.owner.trim()) return "Bitte wähle einen Owner aus.";
  if (!form.startDate) return "Bitte gib ein Von-Datum ein.";
  if (!form.endDate) return "Bitte gib ein Bis-Datum ein.";
  if (!isDateBefore(form.startDate, form.endDate)) return "Das Von-Datum muss vor dem Bis-Datum liegen.";
  return undefined;
}

function validateBookingEditForm(form: BookingEditForm): string | undefined {
  if (!form.title.trim()) return "Bitte gib einen Titel ein.";
  if (!form.startValue) return "Bitte gib einen Startzeitpunkt ein.";
  if (form.endValue && !isDateBefore(form.startValue, form.endValue)) {
    return "Der Startzeitpunkt muss vor dem Endzeitpunkt liegen.";
  }
  return undefined;
}

function toBookingEditForm(booking: CalendarBooking): BookingEditForm {
  return {
    title: booking.title,
    type: booking.type,
    serviceIdentifier: booking.serviceIdentifier ?? "",
    operator: booking.operator ?? "",
    startValue: toDateTimeInputValue(booking.start),
    startTimezone: toOffsetTimezoneValue(booking.start.timezone),
    endValue: booking.end ? toDateTimeInputValue(booking.end) : "",
    endTimezone: toOffsetTimezoneValue(booking.end?.timezone),
    fromText: placeToEditText(booking.from),
    toText: placeToEditText(booking.to),
    travelers: booking.travelers,
    details: booking.details,
  };
}

function buildBookingCorrectionPatch(booking: CalendarBooking, form: BookingEditForm): BookingCorrectionPatch {
  const patch: BookingCorrectionPatch = {};
  if (form.title !== booking.title) patch.title = form.title;
  if (form.type !== booking.type) patch.type = form.type;
  if (normalizeOptionalText(form.serviceIdentifier) !== (booking.serviceIdentifier ?? undefined)) {
    patch.serviceIdentifier = normalizeOptionalText(form.serviceIdentifier) ?? null;
  }
  if (normalizeOptionalText(form.operator) !== (booking.operator ?? undefined)) {
    patch.operator = normalizeOptionalText(form.operator) ?? null;
  }
  const start = toBookingDateTime(form.startValue, form.startTimezone);
  if (!sameJson(start, booking.start)) patch.start = start;

  const end = toOptionalBookingDateTime(form.endValue, form.endTimezone);
  if (!sameJson(end, booking.end)) patch.end = end ?? null;

  const from = toOptionalBookingPlace(form.fromText);
  if (!sameJson(from, booking.from)) patch.from = from ?? null;

  const to = toOptionalBookingPlace(form.toText);
  if (!sameJson(to, booking.to)) patch.to = to ?? null;

  if (!sameJson(form.travelers, booking.travelers)) patch.travelers = form.travelers;
  if (form.details !== booking.details) patch.details = form.details;
  return patch;
}

function toggleTravelerInForm(form: BookingEditForm, traveler: string, checked: boolean): BookingEditForm {
  const travelers = checked
    ? [...new Set([...form.travelers, traveler])]
    : form.travelers.filter((existing) => existing !== traveler);
  return { ...form, travelers };
}

function toBookingDateTime(value: string, timezone: string): BookingDateTime {
  return {
    value: value.trim(),
    precision: "datetime",
    timezone: normalizeOptionalText(timezone),
  };
}

function toOptionalBookingDateTime(
  value: string,
  timezone: string,
): BookingDateTime | undefined {
  if (!value.trim()) return undefined;
  return toBookingDateTime(value, timezone);
}

function toOptionalBookingPlace(text: string): BookingPlace | undefined {
  const normalizedName = normalizeOptionalText(text);
  if (!normalizedName) return undefined;
  return {
    name: normalizedName,
  };
}

function placeToEditText(place: BookingPlace | undefined): string {
  if (!place) return "";
  return [place.name, place.city, place.country].filter(Boolean).join(", ");
}

function toDateTimeInputValue(value: BookingDateTime): string {
  if (value.precision === "date") return `${value.value.slice(0, 10)}T00:00`;
  const withoutZone = value.value.replace(/Z$/, "");
  return withoutZone.slice(0, 16);
}

function toOffsetTimezoneValue(value: string | undefined): string {
  if (!value) return "";
  return /^[-+]\d{2}:\d{2}$/.test(value) ? value : "";
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sameJson(first: unknown, second: unknown): boolean {
  return JSON.stringify(first ?? null) === JSON.stringify(second ?? null);
}

function isDateBefore(start: string, end: string): boolean {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return false;
  return startTime < endTime;
}

type BookingGroup = {
  date: string;
  bookings: CalendarBooking[];
};

function filterBookings(
  bookings: CalendarBooking[],
  filter: { mode: CalendarFilterMode; selectedTravelers: string[]; selectedTrip: string | undefined },
): CalendarBooking[] {
  if (filter.mode === "trip") {
    if (!filter.selectedTrip) return bookings;
    return bookings.filter((booking) => booking.trip?.tripCreatedId === filter.selectedTrip);
  }

  if (filter.selectedTravelers.length === 0) return bookings;
  const selected = new Set(filter.selectedTravelers);
  return bookings.filter((booking) => booking.travelers.some((traveler) => selected.has(traveler)));
}

function groupBookingsByDate(bookings: CalendarBooking[]): BookingGroup[] {
  const groups = new Map<string, CalendarBooking[]>();
  for (const booking of [...bookings].sort(compareCalendarBookings)) {
    const date = booking.start.value.slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), booking]);
  }
  return [...groups.entries()].map(([date, groupBookings]) => ({ date, bookings: groupBookings }));
}

function daysBetween(first: string, second: string): number {
  const firstTime = Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, Number(first.slice(8, 10)));
  const secondTime = Date.UTC(Number(second.slice(0, 4)), Number(second.slice(5, 7)) - 1, Number(second.slice(8, 10)));
  const days = Math.round((secondTime - firstTime) / 86_400_000);
  return Number.isFinite(days) ? days : 0;
}

function daysInRange(startDate: string, endDate: string): string[] {
  const dayCount = daysBetween(startDate, endDate);
  if (dayCount < 0) return [];
  const startTime = Date.UTC(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)) - 1, Number(startDate.slice(8, 10)));
  if (!Number.isFinite(startTime)) return [];
  return Array.from({ length: dayCount + 1 }, (_, index) => {
    const date = new Date(startTime + index * 86_400_000);
    return date.toISOString().slice(0, 10);
  });
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

function formatReportDay(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
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

function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function tripSaveMessage(reason: string): string {
  const messages: Record<string, string> = {
    missing_short_code: "Bitte gib ein Trip-Kürzel ein.",
    missing_owner: "Bitte gib einen Owner ein.",
    invalid_dates: "Bitte gib einen gültigen Zeitraum ein.",
    duplicate_short_code: "Dieses Trip-Kürzel gibt es bereits.",
    trip_not_found: "Dieser Trip wurde nicht gefunden.",
  };
  return messages[reason] ?? "Trip konnte nicht gespeichert werden.";
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
  const { documentName: _documentName, ...rest } = details;
  return Object.keys(rest).length === 0 ? "" : JSON.stringify(rest, null, 2);
}

function formatLogDocument(entry: ActivityLogEntry): string {
  const details = entry.details ?? {};
  const documentName = details.documentName;
  if (typeof documentName === "string" && documentName.trim().length > 0) return documentName;

  const fileName = details.fileName;
  if (typeof fileName === "string" && fileName.trim().length > 0) return fileName;

  const subject = details.subject;
  if (typeof subject === "string" && subject.trim().length > 0) return `E-Mail: ${subject}`;

  const source = details.source;
  if (source === "text") return "Manueller Text";
  if (source === "image") return "Clipboard-Bild";
  if (source === "email") return "E-Mail-Text";
  return "—";
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
