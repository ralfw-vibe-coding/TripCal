import type { AutoAssignBookingsToTripsCommand } from "../../../domain/rpus/auto-assign-bookings-to-trips-command/AutoAssignBookingsToTripsCommand";
import type { GetEmailBookingCandidatesQuery, EmailBookingCandidate } from "../../../domain/rpus/get-email-booking-candidates-query/GetEmailBookingCandidatesQuery";
import type { GetEmailIngestProgressQuery } from "../../../domain/rpus/get-email-ingest-progress-query/GetEmailIngestProgressQuery";
import type { MarkEmailIngestGatheredCommand } from "../../../domain/rpus/mark-email-ingest-gathered-command/MarkEmailIngestGatheredCommand";
import type { RecordDocumentFileUploadedCommand } from "../../../domain/rpus/record-document-file-uploaded-command/RecordDocumentFileUploadedCommand";
import type { RecordEmailBookingCandidatesCommand } from "../../../domain/rpus/record-email-booking-candidates-command/RecordEmailBookingCandidatesCommand";
import type { RecordEmailPartReceivedCommand } from "../../../domain/rpus/record-email-part-received-command/RecordEmailPartReceivedCommand";
import type { RecordExtractedBookingsCommand } from "../../../domain/rpus/record-extracted-bookings-command/RecordExtractedBookingsCommand";
import type { SubmitDocumentTextCommand } from "../../../domain/rpus/submit-document-text-command/SubmitDocumentTextCommand";
import type { EmailPartKind } from "../../../domain/events/events";
import type { ExtractedBooking } from "../../../domain/model";
import type { ActivityLogProvider } from "../../../providers/activity-log/ActivityLogProvider";
import type { BookingExtractionProvider } from "../../../providers/booking-extraction/BookingExtractionProvider";
import type { Clock } from "../../../providers/clock/Clock";
import type { FileStorageProvider } from "../../../providers/file-storage/FileStorageProvider";
import type { TextExtractionProvider } from "../../../providers/text-extraction/TextExtractionProvider";

export type IngestEmailAttachmentInput = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

export type IngestEmailPartInfo = {
  originalMessageId: string;
  partId: string;
  partIndex: number;
  partCount: number;
  partKind: EmailPartKind;
};

export type IngestEmailRequest = {
  messageId: string;
  originalMessageId?: string;
  part?: Partial<IngestEmailPartInfo>;
  from?: string;
  subject?: string;
  receivedAt?: string;
  text?: string;
  attachments: IngestEmailAttachmentInput[];
};

export type IngestEmailResponse =
  | {
      status: "accepted";
      emailIngestedId: string;
      duplicate: boolean;
      gathered: boolean;
      documentFileUploadedIds: string[];
      documentTextRecordedIds: string[];
      bookingExtractedIds: string[];
      warnings?: string[];
    }
  | {
      status: "rejected";
      reason: "missing_message_id" | "no_documents" | "email_processing_failed";
      message: string;
    };

type ProcessedPart =
  | {
      status: "succeeded";
      documentTextRecordedId: string;
      documentFileUploadedId?: string;
      bookings: ExtractedBooking[];
      warnings?: string[];
    }
  | {
      status: "failed";
      message: string;
    };

type DedupeResult = {
  winners: EmailBookingCandidate[];
  discarded: EmailBookingCandidate[];
};

export class IngestEmail {
  constructor(
    private readonly clock: Clock,
    private readonly fileStorageProvider: FileStorageProvider,
    private readonly textExtractionProvider: TextExtractionProvider,
    private readonly bookingExtractionProvider: BookingExtractionProvider,
    private readonly activityLogProvider: ActivityLogProvider,
    private readonly recordEmailPartReceivedCommand: RecordEmailPartReceivedCommand,
    private readonly recordDocumentFileUploadedCommand: RecordDocumentFileUploadedCommand,
    private readonly submitDocumentTextCommand: SubmitDocumentTextCommand,
    private readonly recordEmailBookingCandidatesCommand: RecordEmailBookingCandidatesCommand,
    private readonly getEmailIngestProgressQuery: GetEmailIngestProgressQuery,
    private readonly getEmailBookingCandidatesQuery: GetEmailBookingCandidatesQuery,
    private readonly recordExtractedBookingsCommand: RecordExtractedBookingsCommand,
    private readonly autoAssignBookingsToTripsCommand: AutoAssignBookingsToTripsCommand,
    private readonly markEmailIngestGatheredCommand: MarkEmailIngestGatheredCommand,
  ) {}

  async process(request: IngestEmailRequest): Promise<IngestEmailResponse> {
    const part = resolvePartInfo(request);
    const documentName = describePart(request, part);

    await this.log("info", "E-Mail-Part empfangen", {
      documentName,
      messageId: request.messageId,
      originalMessageId: part.originalMessageId,
      partId: part.partId,
      partIndex: part.partIndex,
      partCount: part.partCount,
      partKind: part.partKind,
      from: request.from,
      subject: request.subject,
      attachmentCount: request.attachments.length,
      hasText: hasUsableText(request.text),
    });

    if (!part.partId || !part.originalMessageId) {
      return { status: "rejected", reason: "missing_message_id", message: "Die E-Mail hat keine Part-ID." };
    }

    if (!hasUsableText(request.text) && request.attachments.length === 0) {
      await this.log("warning", "E-Mail-Part abgelehnt: keine Dokumente", {
        documentName,
        partId: part.partId,
      });
      return { status: "rejected", reason: "no_documents", message: "Der E-Mail-Part enthält keinen Text und keinen Anhang." };
    }

    const received = await this.recordEmailPartReceivedCommand.process({
      ...part,
      messageId: request.messageId,
      from: request.from,
      subject: request.subject,
      receivedAt: request.receivedAt,
      fileName: request.attachments[0]?.fileName,
      ingestedAt: this.clock.now().toISOString(),
    });

    if (received.status === "failed") {
      return { status: "rejected", reason: "missing_message_id", message: "Der E-Mail-Part konnte nicht aufgezeichnet werden." };
    }

    if (received.duplicate) {
      await this.log("info", "E-Mail-Part ignoriert: bereits verarbeitet", {
        documentName,
        partId: part.partId,
        emailPartReceivedId: received.emailPartReceivedId,
      });
      return {
        status: "accepted",
        emailIngestedId: received.emailPartReceivedId,
        duplicate: true,
        gathered: false,
        documentFileUploadedIds: [],
        documentTextRecordedIds: [],
        bookingExtractedIds: [],
        warnings: ["Dieser E-Mail-Part wurde bereits verarbeitet."],
      };
    }

    const processed = await this.processPart(request, part, documentName);
    if (processed.status === "failed") {
      await this.recordEmailBookingCandidatesCommand.process({
        originalMessageId: part.originalMessageId,
        partId: part.partId,
        partKind: part.partKind,
        bookings: [],
        extractedAt: this.clock.now().toISOString(),
      });
      return { status: "rejected", reason: "email_processing_failed", message: processed.message };
    }

    const candidates = await this.recordEmailBookingCandidatesCommand.process({
      originalMessageId: part.originalMessageId,
      partId: part.partId,
      partKind: part.partKind,
      documentTextRecordedId: processed.documentTextRecordedId,
      documentFileUploadedId: processed.documentFileUploadedId,
      fileName: request.attachments[0]?.fileName,
      bookings: processed.bookings,
      extractedAt: this.clock.now().toISOString(),
    });

    if (candidates.status === "failed") {
      return { status: "rejected", reason: "email_processing_failed", message: "Buchungskandidaten konnten nicht aufgezeichnet werden." };
    }

    await this.log("info", "Buchungskandidaten aufgezeichnet", {
      documentName,
      originalMessageId: part.originalMessageId,
      partId: part.partId,
      candidateCount: candidates.candidateExtractedIds.length,
    });

    const progress = await this.getEmailIngestProgressQuery.process({ originalMessageId: part.originalMessageId });
    if (!progress.complete || progress.gathered) {
      await this.log("info", "E-Mail-Gather wartet auf weitere Parts", {
        documentName,
        originalMessageId: part.originalMessageId,
        expectedPartCount: progress.expectedPartCount,
        processedPartCount: progress.processedPartCount,
        gathered: progress.gathered,
      });
      return {
        status: "accepted",
        emailIngestedId: received.emailPartReceivedId,
        duplicate: false,
        gathered: false,
        documentFileUploadedIds: processed.documentFileUploadedId ? [processed.documentFileUploadedId] : [],
        documentTextRecordedIds: [processed.documentTextRecordedId],
        bookingExtractedIds: [],
        warnings: processed.warnings,
      };
    }

    const gathered = await this.gatherEmail(part.originalMessageId, documentName);
    return {
      status: "accepted",
      emailIngestedId: received.emailPartReceivedId,
      duplicate: false,
      gathered: true,
      documentFileUploadedIds: processed.documentFileUploadedId ? [processed.documentFileUploadedId] : [],
      documentTextRecordedIds: [processed.documentTextRecordedId],
      bookingExtractedIds: gathered.bookingExtractedIds,
      warnings: mergeWarnings(processed.warnings, gathered.warnings),
    };
  }

  private async processPart(request: IngestEmailRequest, part: IngestEmailPartInfo, documentName: string): Promise<ProcessedPart> {
    if (part.partKind === "body") {
      return this.processTextPart(request, part, documentName);
    }
    return this.processAttachmentPart(request, part, documentName);
  }

  private async processTextPart(request: IngestEmailRequest, part: IngestEmailPartInfo, documentName: string): Promise<ProcessedPart> {
    if (!hasUsableText(request.text)) {
      return { status: "failed", message: "Der E-Mail-Text ist leer." };
    }

    const recordedAt = this.clock.now().toISOString();
    const submitted = await this.submitDocumentTextCommand.process({
      source: "email",
      emailIngestedId: part.partId,
      text: request.text.trim(),
      recordedAt,
    });
    if (submitted.status === "failed") {
      return { status: "failed", message: "E-Mail-Text konnte nicht aufgezeichnet werden." };
    }

    return this.extractCandidates(request.text, submitted.documentTextRecordedId, documentName);
  }

  private async processAttachmentPart(request: IngestEmailRequest, part: IngestEmailPartInfo, documentName: string): Promise<ProcessedPart> {
    const attachment = request.attachments[0];
    if (!attachment) {
      return { status: "failed", message: "Der E-Mail-Anhang fehlt." };
    }
    if (!isSupportedDocumentFile(attachment.fileName)) {
      return { status: "failed", message: "Nur PDF-Dateien können als E-Mail-Anhang verarbeitet werden." };
    }

    try {
      const dataBase64 = normalizeBase64(attachment.dataBase64);
      const stored = await this.fileStorageProvider.storeFile({
        originalFileName: attachment.fileName,
        mimeType: attachment.mimeType,
        dataBase64,
      });
      const uploadResponse = await this.recordDocumentFileUploadedCommand.process({
        source: "email",
        emailIngestedId: part.partId,
        originalFileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        uploadedAt: this.clock.now().toISOString(),
      });
      if (uploadResponse.status === "failed") {
        return { status: "failed", message: "Anhang konnte nicht registriert werden." };
      }

      const extracted = await this.textExtractionProvider.extractText({
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        dataBase64,
        contentDataUrl: `data:${attachment.mimeType};base64,${dataBase64}`,
      });
      const submitted = await this.submitDocumentTextCommand.process({
        source: "file",
        documentFileUploadedId: uploadResponse.documentFileUploadedId,
        text: extracted.text,
        recordedAt: this.clock.now().toISOString(),
      });
      if (submitted.status === "failed") {
        return { status: "failed", message: "Anhangtext konnte nicht aufgezeichnet werden." };
      }

      const candidates = await this.extractCandidates(extracted.text, submitted.documentTextRecordedId, documentName);
      if (candidates.status === "failed") return candidates;
      return {
        ...candidates,
        documentFileUploadedId: uploadResponse.documentFileUploadedId,
      };
    } catch {
      return { status: "failed", message: "Anhang konnte nicht verarbeitet werden." };
    }
  }

  private async extractCandidates(text: string, documentTextRecordedId: string, documentName: string): Promise<ProcessedPart> {
    try {
      const referenceYear = this.clock.now().getFullYear();
      const extraction = await this.bookingExtractionProvider.extractBookingsFromText({ text, referenceYear });
      await this.log("info", "Buchungskandidaten extrahiert", {
        documentName,
        documentTextRecordedId,
        referenceYear,
        candidateCount: extraction.bookings.length,
        warnings: extraction.warnings,
      });
      return {
        status: "succeeded",
        documentTextRecordedId,
        bookings: extraction.bookings,
        warnings: extraction.warnings,
      };
    } catch {
      return { status: "failed", message: "Buchungskandidaten konnten nicht extrahiert werden." };
    }
  }

  private async gatherEmail(
    originalMessageId: string,
    documentName: string,
  ): Promise<{ bookingExtractedIds: string[]; warnings?: string[] }> {
    const candidates = await this.getEmailBookingCandidatesQuery.process({ originalMessageId });
    const deduped = deduplicateEmailBookingCandidates(candidates.candidates);
    const bookingExtractedIds: string[] = [];
    const warnings: string[] = [];

    for (const [documentTextRecordedId, group] of groupWinnersByDocumentText(deduped.winners)) {
      const response = await this.recordExtractedBookingsCommand.process({
        documentTextRecordedId,
        bookings: group.map((candidate) => candidate.booking),
        extractedAt: this.clock.now().toISOString(),
      });
      if (response.status === "succeeded") {
        bookingExtractedIds.push(...response.bookingExtractedIds);
      } else {
        warnings.push(`Gewinner aus Dokumenttext ${documentTextRecordedId} konnte nicht aufgezeichnet werden: ${response.reason}`);
      }
    }

    if (bookingExtractedIds.length > 0) {
      await this.autoAssignBookingsToTripsCommand.process({
        bookingExtractedIds,
        assignedAt: this.clock.now().toISOString(),
      });
    }

    await this.markEmailIngestGatheredCommand.process({
      originalMessageId,
      bookingExtractedIds,
      discardedCandidateIds: deduped.discarded.map((candidate) => candidate.candidateExtractedId),
      gatheredAt: this.clock.now().toISOString(),
    });

    await this.log("info", "E-Mail-Gather abgeschlossen", {
      documentName,
      originalMessageId,
      candidateCount: candidates.candidates.length,
      recordedCount: bookingExtractedIds.length,
      discardedDuplicateCount: deduped.discarded.length,
    });

    return { bookingExtractedIds, warnings: warnings.length > 0 ? warnings : undefined };
  }

  private async log(level: "info" | "warning" | "error", message: string, details: Record<string, unknown>): Promise<void> {
    try {
      await this.activityLogProvider.append({
        level,
        scope: "email-ingest",
        message,
        details,
      });
    } catch {
      // Activity logging must not block document processing.
    }
  }
}

export function deduplicateEmailBookingCandidates(candidates: EmailBookingCandidate[]): DedupeResult {
  const winners: EmailBookingCandidate[] = [];
  const discarded: EmailBookingCandidate[] = [];

  for (const candidate of candidates) {
    const duplicateIndex = winners.findIndex((winner) => areDuplicateBookings(winner.booking, candidate.booking));
    if (duplicateIndex < 0) {
      winners.push(candidate);
      continue;
    }

    const currentWinner = winners[duplicateIndex];
    if (compareCandidateQuality(candidate, currentWinner) > 0) {
      winners[duplicateIndex] = candidate;
      discarded.push(currentWinner);
    } else {
      discarded.push(candidate);
    }
  }

  return { winners, discarded };
}

function areDuplicateBookings(first: ExtractedBooking, second: ExtractedBooking): boolean {
  if (first.type !== second.type) return false;
  if (dateOnly(first.start.value) !== dateOnly(second.start.value)) return false;
  if (first.serviceIdentifier && second.serviceIdentifier) {
    return normalizeText(first.serviceIdentifier) === normalizeText(second.serviceIdentifier);
  }
  const firstRoute = `${normalizePlace(first.from)}>${normalizePlace(first.to)}`;
  const secondRoute = `${normalizePlace(second.from)}>${normalizePlace(second.to)}`;
  if (firstRoute !== ">" && firstRoute === secondRoute) return true;
  return normalizeText(first.title) === normalizeText(second.title);
}

function compareCandidateQuality(first: EmailBookingCandidate, second: EmailBookingCandidate): number {
  return scoreCandidate(first) - scoreCandidate(second);
}

function scoreCandidate(candidate: EmailBookingCandidate): number {
  const booking = candidate.booking;
  return [
    booking.start.precision === "datetime" ? 8 : 0,
    booking.end ? 7 : 0,
    booking.end?.precision === "datetime" ? 4 : 0,
    booking.from ? 5 : 0,
    booking.to ? 5 : 0,
    booking.serviceIdentifier ? 4 : 0,
    booking.operator ? 3 : 0,
    booking.travelers.length > 0 ? 2 : 0,
    booking.details.trim().length > 0 ? Math.min(4, Math.ceil(booking.details.trim().length / 250)) : 0,
    candidate.partKind === "attachment" ? 2 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function groupWinnersByDocumentText(candidates: EmailBookingCandidate[]): Map<string, EmailBookingCandidate[]> {
  const groups = new Map<string, EmailBookingCandidate[]>();
  for (const candidate of candidates) {
    groups.set(candidate.documentTextRecordedId, [...(groups.get(candidate.documentTextRecordedId) ?? []), candidate]);
  }
  return groups;
}

function resolvePartInfo(request: IngestEmailRequest): IngestEmailPartInfo {
  const partKind = request.part?.partKind ?? inferPartKind(request);
  const originalMessageId = request.part?.originalMessageId ?? request.originalMessageId ?? stripPartSuffix(request.messageId);
  const partId = request.part?.partId ?? request.messageId;
  return {
    originalMessageId,
    partId,
    partIndex: normalizePartNumber(request.part?.partIndex, 0),
    partCount: normalizePartNumber(request.part?.partCount, 1),
    partKind,
  };
}

function inferPartKind(request: IngestEmailRequest): EmailPartKind {
  return request.attachments.length > 0 && !hasUsableText(request.text) ? "attachment" : "body";
}

function normalizePartNumber(value: unknown, fallback: number): number {
  return Number.isInteger(value) ? Number(value) : fallback;
}

function stripPartSuffix(messageId: string): string {
  return messageId.replace(/#(?:body|attachment_\d+)$/, "");
}

function hasUsableText(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function normalizeBase64(value: string): string {
  const marker = ";base64,";
  const markerIndex = value.indexOf(marker);
  return markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value;
}

function describePart(request: IngestEmailRequest, part: IngestEmailPartInfo): string {
  if (part.partKind === "attachment") return `E-Mail-Anhang: ${request.attachments[0]?.fileName ?? part.partId}`;
  return `E-Mail-Text: ${request.subject ?? part.partId}`;
}

function isSupportedDocumentFile(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith(".pdf");
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function normalizePlace(place: ExtractedBooking["from"]): string {
  return normalizeText([place?.name, place?.city, place?.country].filter(Boolean).join(" "));
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function mergeWarnings(...warningGroups: Array<string[] | undefined>): string[] | undefined {
  const warnings = warningGroups.flatMap((group) => group ?? []);
  return warnings.length > 0 ? warnings : undefined;
}
