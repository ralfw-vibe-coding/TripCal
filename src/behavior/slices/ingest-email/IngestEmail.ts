import type { RecordDocumentTextAndExtractBookings } from "../../flows/RecordDocumentTextAndExtractBookings";
import type { RecordDocumentFileUploadedCommand } from "../../../domain/rpus/record-document-file-uploaded-command/RecordDocumentFileUploadedCommand";
import type { RecordEmailIngestedCommand } from "../../../domain/rpus/record-email-ingested-command/RecordEmailIngestedCommand";
import type { ActivityLogProvider } from "../../../providers/activity-log/ActivityLogProvider";
import type { Clock } from "../../../providers/clock/Clock";
import type { FileStorageProvider } from "../../../providers/file-storage/FileStorageProvider";
import type { TextExtractionProvider } from "../../../providers/text-extraction/TextExtractionProvider";

export type IngestEmailAttachmentInput = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

export type IngestEmailRequest = {
  messageId: string;
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

export class IngestEmail {
  constructor(
    private readonly clock: Clock,
    private readonly fileStorageProvider: FileStorageProvider,
    private readonly textExtractionProvider: TextExtractionProvider,
    private readonly activityLogProvider: ActivityLogProvider,
    private readonly recordEmailIngestedCommand: RecordEmailIngestedCommand,
    private readonly recordDocumentFileUploadedCommand: RecordDocumentFileUploadedCommand,
    private readonly recordDocumentTextAndExtractBookings: RecordDocumentTextAndExtractBookings,
  ) {}

  async process(request: IngestEmailRequest): Promise<IngestEmailResponse> {
    await this.log("info", "E-Mail-Ingest empfangen", {
      messageId: request.messageId,
      from: request.from,
      subject: request.subject,
      attachmentCount: request.attachments.length,
      hasText: hasUsableText(request.text),
    });

    if (request.messageId.trim().length === 0) {
      await this.log("warning", "E-Mail-Ingest abgelehnt: fehlende Message-ID", {});
      return { status: "rejected", reason: "missing_message_id", message: "Die E-Mail hat keine Message-ID." };
    }

    if (!hasUsableText(request.text) && request.attachments.length === 0) {
      await this.log("warning", "E-Mail-Ingest abgelehnt: keine Dokumente", { messageId: request.messageId });
      return { status: "rejected", reason: "no_documents", message: "Die E-Mail enthält keinen Text und keine Anhänge." };
    }

    const emailResponse = await this.recordEmailIngestedCommand.process({
      messageId: request.messageId,
      from: request.from,
      subject: request.subject,
      receivedAt: request.receivedAt,
      ingestedAt: this.clock.now().toISOString(),
    });

    if (emailResponse.status === "failed") {
      await this.log("warning", "E-Mail-Ingest abgelehnt: E-Mail konnte nicht aufgezeichnet werden", {
        messageId: request.messageId,
      });
      return { status: "rejected", reason: "missing_message_id", message: "Die E-Mail hat keine Message-ID." };
    }

    if (emailResponse.duplicate) {
      await this.log("info", "E-Mail-Ingest ignoriert: bereits verarbeitet", {
        messageId: request.messageId,
        emailIngestedId: emailResponse.emailIngestedId,
      });
      return {
        status: "accepted",
        emailIngestedId: emailResponse.emailIngestedId,
        duplicate: true,
        documentFileUploadedIds: [],
        documentTextRecordedIds: [],
        bookingExtractedIds: [],
        warnings: ["Diese E-Mail wurde bereits verarbeitet."],
      };
    }

    const documentFileUploadedIds: string[] = [];
    const documentTextRecordedIds: string[] = [];
    const bookingExtractedIds: string[] = [];
    const warnings: string[] = [];

    if (hasUsableText(request.text)) {
      await this.log("info", "E-Mail-Text wird verarbeitet", {
        messageId: request.messageId,
        emailIngestedId: emailResponse.emailIngestedId,
      });
      const textResult = await this.recordDocumentTextAndExtractBookings.process({
        source: "email",
        emailIngestedId: emailResponse.emailIngestedId,
        text: request.text,
      });

      if (textResult.status === "accepted") {
        await this.log("info", "E-Mail-Text verarbeitet", {
          messageId: request.messageId,
          documentTextRecordedId: textResult.documentTextRecordedId,
          bookingCount: textResult.bookingExtractedIds.length,
        });
        documentTextRecordedIds.push(textResult.documentTextRecordedId);
        bookingExtractedIds.push(...textResult.bookingExtractedIds);
        warnings.push(...(textResult.warnings ?? []));
      } else {
        await this.log("warning", "E-Mail-Text konnte nicht verarbeitet werden", {
          messageId: request.messageId,
          reason: textResult.reason,
          message: textResult.message,
        });
        warnings.push(`E-Mail-Text: ${textResult.message}`);
      }
    }

    for (const attachment of request.attachments) {
      await this.log("info", "E-Mail-Anhang wird verarbeitet", {
        messageId: request.messageId,
        emailIngestedId: emailResponse.emailIngestedId,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
      });
      const result = await this.processOneAttachment(emailResponse.emailIngestedId, attachment);
      if (result.status === "failed") {
        await this.log("warning", "E-Mail-Anhang konnte nicht verarbeitet werden", {
          messageId: request.messageId,
          fileName: attachment.fileName,
          message: result.message,
        });
        warnings.push(`${attachment.fileName}: ${result.message}`);
        continue;
      }
      await this.log("info", "E-Mail-Anhang verarbeitet", {
        messageId: request.messageId,
        fileName: attachment.fileName,
        documentFileUploadedId: result.documentFileUploadedId,
        documentTextRecordedId: result.documentTextRecordedId,
        bookingCount: result.bookingExtractedIds.length,
      });
      documentFileUploadedIds.push(result.documentFileUploadedId);
      documentTextRecordedIds.push(result.documentTextRecordedId);
      bookingExtractedIds.push(...result.bookingExtractedIds);
      warnings.push(...(result.warnings ?? []));
    }

    if (documentTextRecordedIds.length === 0) {
      await this.log("warning", "E-Mail-Ingest ohne verarbeitete Dokumenttexte beendet", {
        messageId: request.messageId,
        emailIngestedId: emailResponse.emailIngestedId,
        warnings,
      });
      return {
        status: "rejected",
        reason: "email_processing_failed",
        message: "Aus der E-Mail konnten keine Dokumente verarbeitet werden.",
      };
    }

    return {
      status: "accepted",
      emailIngestedId: emailResponse.emailIngestedId,
      duplicate: false,
      documentFileUploadedIds,
      documentTextRecordedIds,
      bookingExtractedIds,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private async log(
    level: "info" | "warning" | "error",
    message: string,
    details: Record<string, unknown>,
  ): Promise<void> {
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

  private async processOneAttachment(
    emailIngestedId: string,
    attachment: IngestEmailAttachmentInput,
  ): Promise<
    | {
        status: "succeeded";
        documentFileUploadedId: string;
        documentTextRecordedId: string;
        bookingExtractedIds: string[];
        warnings?: string[];
      }
    | { status: "failed"; message: string }
  > {
    try {
      const dataBase64 = normalizeBase64(attachment.dataBase64);
      const stored = await this.fileStorageProvider.storeFile({
        originalFileName: attachment.fileName,
        mimeType: attachment.mimeType,
        dataBase64,
      });

      const uploadResponse = await this.recordDocumentFileUploadedCommand.process({
        source: "email",
        emailIngestedId,
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

      const recorded = await this.recordDocumentTextAndExtractBookings.process({
        source: "file",
        documentFileUploadedId: uploadResponse.documentFileUploadedId,
        text: extracted.text,
      });

      if (recorded.status === "rejected") {
        return { status: "failed", message: recorded.message };
      }

      return {
        status: "succeeded",
        documentFileUploadedId: uploadResponse.documentFileUploadedId,
        documentTextRecordedId: recorded.documentTextRecordedId,
        bookingExtractedIds: recorded.bookingExtractedIds,
        warnings: recorded.warnings,
      };
    } catch {
      return { status: "failed", message: "Anhang konnte nicht verarbeitet werden." };
    }
  }
}

function hasUsableText(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function normalizeBase64(value: string): string {
  const marker = ";base64,";
  const markerIndex = value.indexOf(marker);
  return markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value;
}
