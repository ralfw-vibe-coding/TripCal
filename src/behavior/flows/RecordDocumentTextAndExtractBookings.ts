import type { RecordExtractedBookingsCommand } from "../../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import type { SubmitDocumentTextCommand } from "../../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { ActivityLogProvider } from "../../providers/activity-log/ActivityLogProvider";
import type { BookingExtractionProvider } from "../../providers/booking-extraction/BookingExtractionProvider";
import type { Clock } from "../../providers/clock/Clock";

export type RecordDocumentTextAndExtractBookingsRequest =
  | {
      source: "text" | "image";
      text: string;
    }
  | {
      source: "file";
      documentFileUploadedId: string;
      text: string;
    }
  | {
      source: "email";
      emailIngestedId: string;
      text: string;
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
  ) {}

  async process(
    request: RecordDocumentTextAndExtractBookingsRequest,
  ): Promise<RecordDocumentTextAndExtractBookingsResponse> {
    const text = request.text.trim();
    await this.log("info", "Dokumenttext empfangen", {
      source: request.source,
      textLength: text.length,
      ...(request.source === "file" ? { documentFileUploadedId: request.documentFileUploadedId } : {}),
      ...(request.source === "email" ? { emailIngestedId: request.emailIngestedId } : {}),
    });

    if (text.length === 0) {
      await this.log("warning", "Dokumenttext abgelehnt: leer", { source: request.source });
      return { status: "rejected", reason: "empty_text", message: "Bitte gib einen Dokumenttext ein." };
    }
    if (text.length < 12) {
      await this.log("warning", "Dokumenttext abgelehnt: zu kurz", { source: request.source, textLength: text.length });
      return { status: "rejected", reason: "text_too_short", message: "Der Dokumenttext ist zu kurz." };
    }

    const recordedAt = this.clock.now().toISOString();
    await this.log("info", "Dokumenttext wird aufgezeichnet", { source: request.source, recordedAt });
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
        source: request.source,
        reason: submitResponse.reason,
      });
      return { status: "rejected", reason: "empty_text", message: "Bitte gib einen Dokumenttext ein." };
    }

    await this.log("info", "Dokumenttext aufgezeichnet", {
      source: request.source,
      documentTextRecordedId: submitResponse.documentTextRecordedId,
    });
    await this.log("info", "Buchungsextraktion gestartet", {
      documentTextRecordedId: submitResponse.documentTextRecordedId,
    });

    const extraction = await this.extractBookings(text);
    if (!extraction) {
      await this.log("warning", "Buchungsextraktion fehlgeschlagen", {
        documentTextRecordedId: submitResponse.documentTextRecordedId,
      });
      return {
        status: "rejected",
        reason: "extraction_failed",
        message: "Die Buchungen konnten nicht aus dem Text extrahiert werden.",
      };
    }

    await this.log("info", "Buchungsextraktion abgeschlossen", {
      documentTextRecordedId: submitResponse.documentTextRecordedId,
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
      documentTextRecordedId: submitResponse.documentTextRecordedId,
      bookingExtractedIds: recordResponse.bookingExtractedIds,
    });

    return {
      status: "accepted",
      documentTextRecordedId: submitResponse.documentTextRecordedId,
      bookingExtractedIds: recordResponse.bookingExtractedIds,
      warnings: extraction.warnings,
    };
  }

  private async extractBookings(text: string) {
    try {
      return await this.bookingExtractionProvider.extractBookingsFromText({ text });
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
