import type { AutoAssignBookingsToTripsCommand } from "../../domain/rpus/auto-assign-bookings-to-trips-command/AutoAssignBookingsToTripsCommand";
import type { RecordExtractedBookingsCommand } from "../../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import type { SubmitDocumentTextCommand } from "../../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { ActivityLogProvider } from "../../providers/activity-log/ActivityLogProvider";
import type { BookingExtractionProvider } from "../../providers/booking-extraction/BookingExtractionProvider";
import type { Clock } from "../../providers/clock/Clock";

export type RecordDocumentTextAndExtractBookingsRequest =
  | {
      source: "text" | "image";
      text: string;
      documentName?: string;
    }
  | {
      source: "file";
      documentFileUploadedId: string;
      text: string;
      documentName?: string;
    }
  | {
      source: "email";
      emailIngestedId: string;
      text: string;
      documentName?: string;
    };

export type RecordDocumentTextAndExtractBookingsResponse =
  | {
      status: "accepted";
      documentTextRecordedId: string;
      bookingExtractedIds: string[];
      warnings?: string[];
    }
  | {
      status: "rejected";
      reason: "empty_text" | "text_too_short" | "extraction_failed";
      message: string;
    };

export class RecordDocumentTextAndExtractBookings {
  constructor(
    private readonly clock: Clock,
    private readonly activityLogProvider: ActivityLogProvider,
    private readonly submitDocumentTextCommand: SubmitDocumentTextCommand,
    private readonly bookingExtractionProvider: BookingExtractionProvider,
    private readonly recordExtractedBookingsCommand: RecordExtractedBookingsCommand,
    private readonly autoAssignBookingsToTripsCommand: AutoAssignBookingsToTripsCommand,
  ) {}

  async process(
    request: RecordDocumentTextAndExtractBookingsRequest,
  ): Promise<RecordDocumentTextAndExtractBookingsResponse> {
    const text = request.text.trim();
    const documentDetails = createDocumentLogDetails(request);
    await this.log("info", "Dokumenttext empfangen", {
      ...documentDetails,
      textLength: text.length,
    });

    if (text.length === 0) {
      await this.log("warning", "Dokumenttext abgelehnt: leer", documentDetails);
      return { status: "rejected", reason: "empty_text", message: "Bitte gib einen Dokumenttext ein." };
    }
    if (text.length < 12) {
      await this.log("warning", "Dokumenttext abgelehnt: zu kurz", { ...documentDetails, textLength: text.length });
      return { status: "rejected", reason: "text_too_short", message: "Der Dokumenttext ist zu kurz." };
    }

    const recordedAt = this.clock.now().toISOString();
    await this.log("info", "Dokumenttext wird aufgezeichnet", { ...documentDetails, recordedAt });
    const submitResponse = await this.submitDocumentTextCommand.process(
      request.source === "file"
        ? {
            source: "file",
            documentFileUploadedId: request.documentFileUploadedId,
            text,
            recordedAt,
          }
        : request.source === "email"
          ? {
              source: "email",
              emailIngestedId: request.emailIngestedId,
              text,
              recordedAt,
            }
        : {
            source: request.source,
            text,
            recordedAt,
          },
    );
    if (submitResponse.status === "failed") {
      await this.log("warning", "Dokumenttext konnte nicht aufgezeichnet werden", {
        ...documentDetails,
        reason: submitResponse.reason,
      });
      return { status: "rejected", reason: "empty_text", message: "Bitte gib einen Dokumenttext ein." };
    }

    await this.log("info", "Dokumenttext aufgezeichnet", {
      ...documentDetails,
      documentTextRecordedId: submitResponse.documentTextRecordedId,
    });
    const referenceYear = this.clock.now().getFullYear();
    await this.log("info", "Buchungsextraktion gestartet", {
      ...documentDetails,
      documentTextRecordedId: submitResponse.documentTextRecordedId,
      referenceYear,
    });

    const extraction = await this.extractBookings(text, referenceYear);
    if (!extraction) {
      await this.log("warning", "Buchungsextraktion fehlgeschlagen", {
        ...documentDetails,
        documentTextRecordedId: submitResponse.documentTextRecordedId,
      });
      return {
        status: "rejected",
        reason: "extraction_failed",
        message: "Die Buchungen konnten nicht aus dem Text extrahiert werden.",
      };
    }

    await this.log("info", "Buchungsextraktion abgeschlossen", {
      ...documentDetails,
      documentTextRecordedId: submitResponse.documentTextRecordedId,
      referenceYear,
      bookingCount: extraction.bookings.length,
      warnings: extraction.warnings,
    });

    const recordResponse = await this.recordExtractedBookingsCommand.process({
      documentTextRecordedId: submitResponse.documentTextRecordedId,
      bookings: extraction.bookings,
      extractedAt: this.clock.now().toISOString(),
    });

    if (recordResponse.status === "failed") {
      await this.log("warning", "Extrahierte Buchungen konnten nicht aufgezeichnet werden", {
        ...documentDetails,
        documentTextRecordedId: submitResponse.documentTextRecordedId,
        reason: recordResponse.reason,
      });
      return {
        status: "rejected",
        reason: "extraction_failed",
        message: "Aus dem Text konnten keine Buchungen extrahiert werden.",
      };
    }

    await this.log("info", "Extrahierte Buchungen aufgezeichnet", {
      ...documentDetails,
      documentTextRecordedId: submitResponse.documentTextRecordedId,
      bookingExtractedIds: recordResponse.bookingExtractedIds,
    });

    const autoAssignmentResponse = await this.autoAssignBookingsToTripsCommand.process({
      bookingExtractedIds: recordResponse.bookingExtractedIds,
      assignedAt: this.clock.now().toISOString(),
    });
    await this.log("info", "Automatische Trip-Zuordnung abgeschlossen", {
      ...documentDetails,
      documentTextRecordedId: submitResponse.documentTextRecordedId,
      assignedCount: autoAssignmentResponse.bookingAssignedToTripIds.length,
      skipped: autoAssignmentResponse.skipped,
    });

    return {
      status: "accepted",
      documentTextRecordedId: submitResponse.documentTextRecordedId,
      bookingExtractedIds: recordResponse.bookingExtractedIds,
      warnings: extraction.warnings,
    };
  }

  private async extractBookings(text: string, referenceYear: number) {
    try {
      return await this.bookingExtractionProvider.extractBookingsFromText({ text, referenceYear });
    } catch {
      return undefined;
    }
  }

  private async log(level: "info" | "warning" | "error", message: string, details: Record<string, unknown>): Promise<void> {
    try {
      await this.activityLogProvider.append({
        level,
        scope: "document-processing",
        message,
        details,
      });
    } catch {
      // Activity logging must not block document processing.
    }
  }
}

function createDocumentLogDetails(request: RecordDocumentTextAndExtractBookingsRequest): Record<string, unknown> {
  return {
    documentName: request.documentName ?? defaultDocumentName(request.source),
    source: request.source,
    ...(request.source === "file" ? { documentFileUploadedId: request.documentFileUploadedId } : {}),
    ...(request.source === "email" ? { emailIngestedId: request.emailIngestedId } : {}),
  };
}

function defaultDocumentName(source: RecordDocumentTextAndExtractBookingsRequest["source"]): string {
  if (source === "text") return "Manueller Dokumenttext";
  if (source === "image") return "Clipboard-Bild";
  if (source === "email") return "E-Mail-Text";
  return "Datei";
}
