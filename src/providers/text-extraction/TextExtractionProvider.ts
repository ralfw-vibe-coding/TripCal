export type ExtractTextRequest = {
  contentDataUrl: string;
  mimeType: string;
};

export type ExtractTextResponse = {
  text: string;
};

export interface TextExtractionProvider {
  extractText(request: ExtractTextRequest): Promise<ExtractTextResponse>;
}

