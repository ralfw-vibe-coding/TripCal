import type { AnalysisTrigger } from "./AnalysisTrigger.js";

export class NoopAnalysisTrigger implements AnalysisTrigger {
  async triggerAnalyzeNextDocument(): Promise<void> {
    return;
  }
}

