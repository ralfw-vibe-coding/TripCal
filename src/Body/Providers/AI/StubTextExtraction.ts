import type { TextExtraction } from "./TextExtraction.js";

export class StubTextExtraction implements TextExtraction {
  async extractText(): Promise<string> {
    return "";
  }
}

