import type { SubmitDocumentTextResponse } from "../../behavior/slices/submit-document-text/SubmitDocumentText";
import type { ViewBookingCalendarResponse } from "../../behavior/slices/view-booking-calendar/ViewBookingCalendar";

export async function viewBookingCalendar(): Promise<ViewBookingCalendarResponse> {
  const response = await fetch("/api/view-booking-calendar");
  if (!response.ok) {
    throw new Error("Kalender konnte nicht geladen werden.");
  }
  return (await response.json()) as ViewBookingCalendarResponse;
}

export async function submitDocumentText(text: string): Promise<SubmitDocumentTextResponse> {
  const response = await fetch("/api/submit-document-text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const body = (await response.json()) as SubmitDocumentTextResponse;
  if (!response.ok && body.status !== "rejected") {
    throw new Error("Dokumenttext konnte nicht eingereicht werden.");
  }
  return body;
}

