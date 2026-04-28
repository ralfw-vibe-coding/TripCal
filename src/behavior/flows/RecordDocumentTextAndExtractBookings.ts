import type { RecordExtractedBookingsCommand } from "../../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import type { SubmitDocumentTextCommand } from "../../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { BookingExtractionProvider } from "../../providers/booking-extraction/BookingExtractionProvider";
import type { Clock } from "../../providers/clock/Clock";

export type RecordDocumentTextAndExtractBookingsRequest = {
  source: "text" | "image";
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
    private readonly submitDocumentTextCommand: SubmitDocumentTextCommand,
    private readonly bookingExtractionProvider: BookingExtractionProvider,
    private readonly recordExtractedBookingsCommand: RecordExtractedBookingsCommand,
  ) {}

  async process(
    request: RecordDocumentTextAndExtractBookingsRequest,
  ): Promise<RecordDocumentTextAndExtractBookingsResponse> {
    const text = request.text.trim();
    if (text.length === 0) {
      return { status: "rejected", reason: "empty_text", message: "Bitte gib einen Dokumenttext ein." };
    }
    if (text.length < 12) {
      return { status: "rejected", reason: "text_too_short", message: "Der Dokumenttext ist zu kurz." };
    }

    const recordedAt = this.clock.now().toISOString();
    const submitResponse = await this.submitDocumentTextCommand.process({
      source: request.source,
      text,
      recordedAt,
    });
    if (submitResponse.status === "failed") {
      return { status: "rejected", reason: "empty_text", message: "Bitte gib einen Dokumenttext ein." };
    }

    const extraction = await this.extractBookings(text);
    if (!extraction) {
      return {
        status: "rejected",
        reason: "extraction_failed",
        message: "Die Buchungen konnten nicht aus dem Text extrahiert werden.",
      };
    }

    const recordResponse = await this.recordExtractedBookingsCommand.process({
      documentTextRecordedId: submitResponse.documentTextRecordedId,
      bookings: extraction.bookings,
      extractedAt: this.clock.now().toISOString(),
    });

    if (recordResponse.status === "failed") {
      return {
        status: "rejected",
        reason: "extraction_failed",
        message: "Aus dem Text konnten keine Buchungen extrahiert werden.",
      };
    }

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
}
