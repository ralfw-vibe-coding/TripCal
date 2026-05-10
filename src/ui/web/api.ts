import type { SubmitDocumentTextResponse } from "../../behavior/slices/submit-document-text/SubmitDocumentText";
import type { SubmitDocumentImageResponse } from "../../behavior/slices/submit-document-image/SubmitDocumentImage";
import type {
  SubmitDocumentFileInput,
  SubmitDocumentFilesResponse,
} from "../../behavior/slices/submit-document-files/SubmitDocumentFiles";
import type { ViewBookingCalendarResponse } from "../../behavior/slices/view-booking-calendar/ViewBookingCalendar";
import type { DeleteBookingResponse } from "../../behavior/slices/delete-booking/DeleteBooking";
import type { AssignBookingToTripResponse } from "../../behavior/slices/assign-booking-to-trip/AssignBookingToTrip";
import type { ChangeBookingStatusResponse } from "../../behavior/slices/change-booking-status/ChangeBookingStatus";
import type { CorrectBookingResponse } from "../../behavior/slices/correct-booking/CorrectBooking";
import type { CreateTripResponse } from "../../behavior/slices/create-trip/CreateTrip";
import type { ViewTripsResponse } from "../../behavior/slices/view-trips/ViewTrips";
import type { BookingCorrectionPatch, BookingStatus } from "../../domain/model";
import type { ActivityLogEntry } from "../../providers/activity-log/ActivityLogProvider";

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
  const results = await Promise.all(files.map((file) => submitOneDocumentFile(file)));
  const accepted = results.filter((result): result is Extract<SubmitDocumentFilesResponse, { status: "accepted" }> => result.status === "accepted");
  const rejected = results.filter((result): result is Extract<SubmitDocumentFilesResponse, { status: "rejected" }> => result.status === "rejected");

  if (accepted.length === 0) {
    return {
      status: "rejected",
      reason: "file_processing_failed",
      message: rejected.map((result) => result.message).join("\n") || "Dateien konnten nicht eingereicht werden.",
    };
  }

  return {
    status: "accepted",
    documentFileUploadedIds: accepted.flatMap((result) => result.documentFileUploadedIds),
    documentTextRecordedIds: accepted.flatMap((result) => result.documentTextRecordedIds),
    bookingExtractedIds: accepted.flatMap((result) => result.bookingExtractedIds),
    warnings: [
      ...accepted.flatMap((result) => result.warnings ?? []),
      ...rejected.map((result) => result.message),
    ].filter(Boolean),
  };
}

async function submitOneDocumentFile(file: SubmitDocumentFileInput): Promise<SubmitDocumentFilesResponse> {
  const response = await fetch("/api/submit-document-files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: [file] }),
  });
  const body = await readJsonResponse<SubmitDocumentFilesResponse>(response, `${file.fileName} konnte nicht eingereicht werden.`);
  if (!response.ok && body.status !== "rejected") {
    throw new Error(`${file.fileName} konnte nicht eingereicht werden.`);
  }
  return body;
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  throw new Error(text.trim().startsWith("<") ? fallbackMessage : text || fallbackMessage);
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

export async function correctBooking(
  bookingExtractedId: string,
  patch: BookingCorrectionPatch,
): Promise<CorrectBookingResponse> {
  const response = await fetch("/api/correct-booking", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookingExtractedId, patch }),
  });
  const body = (await response.json()) as CorrectBookingResponse;
  if (!response.ok && body.status !== "rejected") {
    throw new Error("Buchung konnte nicht korrigiert werden.");
  }
  return body;
}

export async function changeBookingStatus(
  bookingExtractedId: string,
  status: BookingStatus,
): Promise<ChangeBookingStatusResponse> {
  const response = await fetch("/api/change-booking-status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookingExtractedId, status }),
  });
  const body = (await response.json()) as ChangeBookingStatusResponse;
  if (!response.ok && body.status !== "rejected") {
    throw new Error("Status konnte nicht geändert werden.");
  }
  return body;
}

export async function viewActivityLog(): Promise<{ entries: ActivityLogEntry[] }> {
  const response = await fetch("/api/activity-log");
  if (!response.ok) {
    throw new Error("Log konnte nicht geladen werden.");
  }
  return (await response.json()) as { entries: ActivityLogEntry[] };
}

export async function viewTrips(): Promise<ViewTripsResponse> {
  const response = await fetch("/api/view-trips");
  if (!response.ok) {
    throw new Error("Trips konnten nicht geladen werden.");
  }
  return (await response.json()) as ViewTripsResponse;
}

export async function createTrip(request: {
  shortCode: string;
  title?: string;
  owner: string;
  startDate: string;
  endDate: string;
}): Promise<CreateTripResponse> {
  const response = await fetch("/api/create-trip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await response.json()) as CreateTripResponse;
  if (!response.ok && body.status !== "failed") {
    throw new Error("Trip konnte nicht angelegt werden.");
  }
  return body;
}

export async function assignBookingToTrip(
  bookingExtractedId: string,
  tripCreatedId: string,
): Promise<AssignBookingToTripResponse> {
  const response = await fetch("/api/assign-booking-to-trip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookingExtractedId, tripCreatedId }),
  });
  const body = (await response.json()) as AssignBookingToTripResponse;
  if (!response.ok && body.status !== "failed") {
    throw new Error("Trip konnte nicht zugeordnet werden.");
  }
  return body;
}
