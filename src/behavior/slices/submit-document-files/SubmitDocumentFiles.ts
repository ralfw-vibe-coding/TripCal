import type { RecordDocumentTextAndExtractBookings } from "../../flows/RecordDocumentTextAndExtractBookings";
import type { RecordDocumentFileUploadedCommand } from "../../../domain/rpus/record-document-file-uploaded-command/RecordDocumentFileUploadedCommand";
import type { ActivityLogProvider } from "../../../providers/activity-log/ActivityLogProvider";
import type { Clock } from "../../../providers/clock/Clock";
import type { FileStorageProvider } from "../../../providers/file-storage/FileStorageProvider";
import type { TextExtractionProvider } from "../../../providers/text-extraction/TextExtractionProvider";

export type SubmitDocumentFileInput = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  dataUrl: string;
};

export type SubmitDocumentFilesRequest = {
  files: SubmitDocumentFileInput[];
};

export type SubmitDocumentFilesResponse =
  | {
      status: "accepted";
      documentFileUploadedIds: string[];
      documentTextRecordedIds: string[];
      bookingExtractedIds: string[];
      warnings?: string[];
    }
  | {
      status: "rejected";
      reason: "no_files" | "file_processing_failed";
      message: string;
    };

export class SubmitDocumentFiles {
  constructor(
    private readonly clock: Clock,
    private readonly activityLogProvider: ActivityLogProvider,
    private readonly fileStorageProvider: FileStorageProvider,
    private readonly textExtractionProvider: TextExtractionProvider,
    private readonly recordDocumentFileUploadedCommand: RecordDocumentFileUploadedCommand,
    private readonly recordDocumentTextAndExtractBookings: RecordDocumentTextAndExtractBookings,
  ) {}

  async process(request: SubmitDocumentFilesRequest): Promise<SubmitDocumentFilesResponse> {
    if (request.files.length === 0) {
      return { status: "rejected", reason: "no_files", message: "Bitte wähle mindestens eine Datei aus." };
    }

    const documentFileUploadedIds: string[] = [];
    const documentTextRecordedIds: string[] = [];
    const bookingExtractedIds: string[] = [];
    const warnings: string[] = [];

    for (const file of request.files) {
      const result = await this.processOneFile(file);
      if (result.status === "failed") {
        warnings.push(`${file.fileName}: ${result.message}`);
        continue;
      }
      documentFileUploadedIds.push(result.documentFileUploadedId);
      documentTextRecordedIds.push(result.documentTextRecordedId);
      bookingExtractedIds.push(...result.bookingExtractedIds);
      warnings.push(...(result.warnings ?? []));
    }

    if (documentTextRecordedIds.length === 0) {
      return {
        status: "rejected",
        reason: "file_processing_failed",
        message: "Aus den Dateien konnten keine Buchungen extrahiert werden.",
      };
    }

    return {
      status: "accepted",
      documentFileUploadedIds,
      documentTextRecordedIds,
      bookingExtractedIds,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private async processOneFile(file: SubmitDocumentFileInput): Promise<
    | {
        status: "succeeded";
        documentFileUploadedId: string;
        documentTextRecordedId: string;
        bookingExtractedIds: string[];
        warnings?: string[];
      }
    | { status: "failed"; message: string }
  > {
    const documentName = `Dateiupload: ${file.fileName}`;
    try {
      await this.log("info", "Dateiupload empfangen", {
        documentName,
        fileName: file.fileName,
        mimeType: file.mimeType,
      });

      const stored = await this.fileStorageProvider.storeFile({
        originalFileName: file.fileName,
        mimeType: file.mimeType,
        dataBase64: file.dataBase64,
      });
      await this.log("info", "Datei gespeichert", {
        documentName,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: stored.sizeBytes,
      });

      const uploadResponse = await this.recordDocumentFileUploadedCommand.process({
        originalFileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        uploadedAt: this.clock.now().toISOString(),
      });

      if (uploadResponse.status === "failed") {
        await this.log("warning", "Datei konnte nicht registriert werden", {
          documentName,
          fileName: file.fileName,
          reason: uploadResponse.reason,
        });
        return { status: "failed", message: "Datei konnte nicht registriert werden." };
      }

      await this.log("info", "Textextraktion gestartet", {
        documentName,
        fileName: file.fileName,
        mimeType: file.mimeType,
        documentFileUploadedId: uploadResponse.documentFileUploadedId,
      });
      const extracted = await this.textExtractionProvider.extractText({
        mimeType: file.mimeType,
        fileName: file.fileName,
        dataBase64: file.dataBase64,
        contentDataUrl: file.dataUrl,
      });
      await this.log("info", "Textextraktion abgeschlossen", {
        documentName,
        fileName: file.fileName,
        textLength: extracted.text.trim().length,
        documentFileUploadedId: uploadResponse.documentFileUploadedId,
      });

      const recorded = await this.recordDocumentTextAndExtractBookings.process({
        source: "file",
        documentFileUploadedId: uploadResponse.documentFileUploadedId,
        documentName,
        text: extracted.text,
      });

      if (recorded.status === "rejected") {
        await this.log("warning", "Dateiupload konnte nicht verarbeitet werden", {
          documentName,
          fileName: file.fileName,
          reason: recorded.reason,
          message: recorded.message,
        });
        return { status: "failed", message: recorded.message };
      }

      return {
        status: "succeeded",
        documentFileUploadedId: uploadResponse.documentFileUploadedId,
        documentTextRecordedId: recorded.documentTextRecordedId,
        bookingExtractedIds: recorded.bookingExtractedIds,
        warnings: recorded.warnings,
      };
    } catch (error) {
      await this.log("error", "Dateiupload unerwartet fehlgeschlagen", {
        documentName,
        fileName: file.fileName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { status: "failed", message: "Datei konnte nicht verarbeitet werden." };
    }
  }

  private async log(
    level: "info" | "warning" | "error",
    message: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.activityLogProvider.append({
        level,
        scope: "document-upload",
        message,
        details,
      });
    } catch {
      // Activity logging must not block document processing.
    }
  }
}
