export type TravelerAliases = Record<string, string[]>;

export type ResolvedTravelers = {
  travelers: string[];
  rawTravelers?: string[];
};

export class TravelerResolver {
  private readonly aliasToLabel: Map<string, string>;

  constructor(aliases: TravelerAliases) {
    this.aliasToLabel = buildAliasMap(aliases);
  }

  labels(): string[] {
    return [...new Set(this.aliasToLabel.values())].sort();
  }

  resolve(rawTravelers: string[]): ResolvedTravelers {
    const labels = new Set<string>();
    const raw = rawTravelers.map((traveler) => traveler.trim()).filter(Boolean);

    for (const traveler of raw) {
      const label = this.aliasToLabel.get(normalizeTravelerName(traveler));
      if (label) {
        labels.add(label);
      }
    }

    return {
      travelers: [...labels],
      rawTravelers: raw.length > 0 ? raw : undefined,
    };
  }
}

export function parseTravelerAliases(value: string | undefined): TravelerAliases {
  if (!value?.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("TRAVELERS_JSON must be a JSON object.");
  }

  const aliases: TravelerAliases = {};
  for (const [label, values] of Object.entries(parsed)) {
    if (!Array.isArray(values)) {
      throw new Error(`TRAVELERS_JSON entry for ${label} must be an array.`);
    }
    aliases[label] = values.map((alias) => String(alias));
  }

  return aliases;
}

function buildAliasMap(aliases: TravelerAliases): Map<string, string> {
  const aliasToLabel = new Map<string, string>();
  for (const [label, values] of Object.entries(aliases)) {
    const candidates = [label, ...values];
    for (const candidate of candidates) {
      const normalized = normalizeTravelerName(candidate);
      const existing = aliasToLabel.get(normalized);
      if (existing && existing !== label) {
        throw new Error(`Traveler alias "${candidate}" is configured for both ${existing} and ${label}.`);
      }
      aliasToLabel.set(normalized, label);
    }
  }
  return aliasToLabel;
}

function normalizeTravelerName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
