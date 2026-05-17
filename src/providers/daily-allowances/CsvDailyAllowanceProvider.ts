import { readFile } from "node:fs/promises";
import type { DailyAllowance } from "../../domain/model";
import type { DailyAllowanceProvider } from "./DailyAllowanceProvider";

export class CsvDailyAllowanceProvider implements DailyAllowanceProvider {
  constructor(private readonly csvPath: string) {}

  async listDailyAllowances(): Promise<DailyAllowance[]> {
    const text = await readFile(this.csvPath, "utf8");
    return parseDailyAllowancesCsv(text);
  }
}

export function parseDailyAllowancesCsv(text: string): DailyAllowance[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return rows
    .slice(1)
    .map((line) => {
      const [country = "", countryAbbr = "", amount = ""] = parseCsvLine(line);
      return {
        country: country.trim(),
        countryAbbr: countryAbbr.trim(),
        dailyAllowanceEuro: Number(amount),
      };
    })
    .filter((entry) => entry.country && entry.countryAbbr && Number.isFinite(entry.dailyAllowanceEuro))
    .sort((a, b) => a.country.localeCompare(b.country));
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}
