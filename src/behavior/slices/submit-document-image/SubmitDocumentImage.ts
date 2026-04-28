import type {
  RecordDocumentTextAndExtractBookings,
  RecordDocumentTextAndExtractBookingsResponse,
} from "../../flows/RecordDocumentTextAndExtractBookings";
import type { TextExtractionProvider } from "../../../providers/text-extraction/TextExtractionProvider";

export type SubmitDocumentImageRequest = {
  imageDataUrl: string;
  mimeType: string;
};

export type SubmitDocumentImageResponse =
  | RecordDocumentTextAndExtractBookingsResponse
  | {
      status: "rejected";
      reason: "missing_image" | "unsupported_image" | "text_extraction_failed";
      message: string;
    };

export class SubmitDocumentImage {
  constructor(
    private readonly textExtractionProvider: TextExtractionProvider,
    private readonly recordDocumentTextAndExtractBookings: RecordDocumentTextAndExtractBookings,
  ) {}

  async process(request: SubmitDocumentImageRequest): Promise<SubmitDocumentImageResponse> {
    if (!request.imageDataUrl.trim()) {
      return { status: "rejected", reason: "missing_image", message: "Bitte füge ein Bild ein." };
    }
    if (!request.mimeType.startsWith("image/")) {
      return { status: "rejected", reason: "unsupported_image", message: "Dieses Bildformat wird nicht unterstützt." };
    }

    const extracted = await this.extractText(request);
    if (!extracted?.text.trim()) {
      return {
        status: "rejected",
        reason: "text_extraction_failed",
        message: "Aus dem Bild konnte kein Text extrahiert werden.",
      };
    }

    return this.recordDocumentTextAndExtractBookings.process({
      source: "image",
      text: extracted.text,
    });
  }

  private async extractText(request: SubmitDocumentImageRequest) {
    try {
      return await this.textExtractionProvider.extractText({
        contentDataUrl: request.imageDataUrl,
        mimeType: request.mimeType,
      });
    } catch {
      return undefined;
    }
  }
}

