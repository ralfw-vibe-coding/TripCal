import { describe, expect, it } from "vitest";
import { parseDailyAllowancesCsv } from "./CsvDailyAllowanceProvider";

describe("parseDailyAllowancesCsv", () => {
  it("handles quoted commas and ignores rows without abbreviation", () => {
    const result = parseDailyAllowancesCsv(
      [
        "Country,Abbr.,Daily Allowance (Euro)",
        "Germany,GER,56",
        "\"Other countries (Australia, New Zealand and Oceania)\",,59",
        "Austria,AUT,56",
      ].join("\n"),
    );

    expect(result).toEqual([
      { country: "Austria", countryAbbr: "AUT", dailyAllowanceEuro: 56 },
      { country: "Germany", countryAbbr: "GER", dailyAllowanceEuro: 56 },
    ]);
  });
});
