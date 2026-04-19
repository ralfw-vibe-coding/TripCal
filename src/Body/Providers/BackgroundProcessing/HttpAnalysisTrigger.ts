import type { AnalysisTrigger } from "./AnalysisTrigger.js";

export class HttpAnalysisTrigger implements AnalysisTrigger {
  constructor(private readonly analyzeNextDocumentUrl: string) {}

  async triggerAnalyzeNextDocument(): Promise<void> {
    const response = await fetch(this.analyzeNextDocumentUrl, {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(
        `failed to trigger analyzeNextDocument: ${response.status} ${response.statusText}`
      );
    }
  }
}

