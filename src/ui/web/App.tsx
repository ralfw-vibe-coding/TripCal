import { CalendarDays, FileText, Loader2, Plus, RefreshCw, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CalendarBooking } from "../../domain/model";
import { submitDocumentText, viewBookingCalendar } from "./api";

const exampleText = `Title: Flug Frankfurt nach Bangkok
Type: flight
Start: 2026-11-03T14:45:00+01:00
End: 2026-11-04T09:20:00+07:00
From: Frankfurt Airport
To: Bangkok Suvarnabhumi
Travelers: Ralf, Ralfs Frau
Airline: Thai Airways
Booking number: ABC123`;

export function App() {
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [text, setText] = useState(exampleText);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

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

  async function handleSubmit() {
    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const response = await submitDocumentText(text);
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
          <button className="primaryButton" type="button" onClick={() => setShowSubmit(true)}>
            <Plus size={18} />
            Dokumenttext
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
          <section className="dialog" aria-label="Dokumenttext einreichen">
            <header className="dialogHeader">
              <div>
                <div className="eyebrow">Dokument einreichen</div>
                <h2>Text erfassen</h2>
              </div>
              <button className="iconButton" type="button" onClick={() => setShowSubmit(false)} title="Schließen">
                <X size={18} />
              </button>
            </header>
            <textarea value={text} onChange={(event) => setText(event.target.value)} />
            <footer className="dialogFooter">
              <div className="hint">
                <FileText size={16} />
                Mehrere Buchungen mit einer Zeile aus drei Bindestrichen trennen.
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
}

type BookingGroup = {
  date: string;
  bookings: CalendarBooking[];
};

function groupBookingsByDate(bookings: CalendarBooking[]): BookingGroup[] {
  const groups = new Map<string, CalendarBooking[]>();
  for (const booking of bookings) {
    const date = booking.start.value.slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), booking]);
  }
  return [...groups.entries()].map(([date, groupBookings]) => ({ date, bookings: groupBookings }));
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

