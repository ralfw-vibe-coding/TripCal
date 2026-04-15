export interface TextExtraction {
  extractText(input: {
    storageKey: string;
    contentType: string;
  }): Promise<string>;
}

