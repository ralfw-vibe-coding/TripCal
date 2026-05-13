import { describe, expect, it } from "vitest";
import { normalizeExtractedDateTime } from "./OpenAIBookingExtractionProvider";

describe("normalizeExtractedDateTime", () => {
  it("uses the reference year when the extracted source date has no year", () => {
    const normalized = normalizeExtractedDateTime(
      {
        sourceText: "23. Dezember, 14:30",
        date: { year: null, month: 12, day: 23 },
        time: { hour: 14, minute: 30 },
      },
      2026,
      "Start",
    );

    expect(normalized?.dateTime).toEqual({
      value: "2026-12-23T14:30:00",
      precision: "datetime",
      timezone: undefined,
    });
    expect(normalized?.warnings).toEqual(["Start: Jahr aus Referenzjahr 2026 ergänzt (Quelle: 23. Dezember, 14:30)."]);
  });

  it("keeps the extracted year when the source date contains one", () => {
    const normalized = normalizeExtractedDateTime(
      {
        sourceText: "03.04.2025",
        date: { year: 2025, month: 4, day: 3 },
        time: null,
      },
      2026,
      "Start",
    );

    expect(normalized?.dateTime).toEqual({
      value: "2025-04-03",
      precision: "date",
      timezone: undefined,
    });
    expect(normalized?.warnings).toEqual([]);
  });
});
