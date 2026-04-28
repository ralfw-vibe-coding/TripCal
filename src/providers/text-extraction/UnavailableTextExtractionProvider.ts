import type { ExtractTextRequest, ExtractTextResponse, TextExtractionProvider } from "./TextExtractionProvider";

export class UnavailableTextExtractionProvider implements TextExtractionProvider {
  async extractText(_request: ExtractTextRequest): Promise<ExtractTextResponse> {
    throw new Error("Text extraction is unavailable without OPENAI_API_KEY.");
  }
}

