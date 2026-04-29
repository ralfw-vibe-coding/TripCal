import type { SubmitDocumentTextResponse } from "../../behavior/slices/submit-document-text/SubmitDocumentText";
import type { SubmitDocumentImageResponse } from "../../behavior/slices/submit-document-image/SubmitDocumentImage";
import type {
  SubmitDocumentFileInput,
  SubmitDocumentFilesResponse,
} from "../../behavior/slices/submit-document-files/SubmitDocumentFiles";
import type { ViewBookingCalendarResponse } from "../../behavior/slices/view-booking-calendar/ViewBookingCalendar";
import type { DeleteBookingResponse } from "../../behavior/slices/delete-booking/DeleteBooking";

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

export async function submitDocumentImage(imageDataUrl: string, mimeType: string): Promise<SubmitDocumentImageResponse> {
  const response = await fetch("/api/submit-document-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageDataUrl, mimeType }),
  });
  const body = (await response.json()) as SubmitDocumentImageResponse;
  if (!response.ok && body.status !== "rejected") {
    throw new Error("Bild konnte nicht eingereicht werden.");
  }
  return body;
}

export async function submitDocumentFiles(files: SubmitDocumentFileInput[]): Promise<SubmitDocumentFilesResponse> {
  const response = await fetch("/api/submit-document-files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files }),
  });
  const body = (await response.json()) as SubmitDocumentFilesResponse;
  if (!response.ok && body.status !== "rejected") {
    throw new Error("Dateien konnten nicht eingereicht werden.");
  }
  return body;
}

export async function deleteBooking(bookingExtractedId: string): Promise<DeleteBookingResponse> {
  const response = await fetch("/api/delete-booking", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookingExtractedId }),
  });
  const body = (await response.json()) as DeleteBookingResponse;
  if (!response.ok && body.status !== "rejected") {
    throw new Error("Buchung konnte nicht gelöscht werden.");
  }
  return body;
}
