export type ExtractTextRequest = {
  mimeType: string;
  contentDataUrl?: string;
  fileName?: string;
  dataBase64?: string;
};

export type ExtractTextResponse = {
  text: string;
};

export interface TextExtractionProvider {
  extractText(request: ExtractTextRequest): Promise<ExtractTextResponse>;
}
