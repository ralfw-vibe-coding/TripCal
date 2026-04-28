import type {
  BookingExtractionProvider,
  ExtractBookingsFromTextRequest,
  ExtractBookingsFromTextResponse,
} from "./BookingExtractionProvider";
import type { BookingDateTime, BookingPlace, BookingType, ExtractedBooking } from "../../domain/model";

const bookingTypes = new Set<BookingType>([
  "flight",
  "accommodation",
  "train",
  "bus",
  "ferry",
  "car",
  "event",
  "restaurant",
  "activity",
  "other",
]);

export class RuleBasedBookingExtractionProvider implements BookingExtractionProvider {
  async extractBookingsFromText(request: ExtractBookingsFromTextRequest): Promise<ExtractBookingsFromTextResponse> {
    const blocks = request.text
      .split(/\n-{3,}\n/g)
      .map((block) => block.trim())
      .filter(Boolean);

    const bookings = blocks.map((block, index) => parseBlock(block, index));
    return {
      bookings,
      warnings: [
        "Demo-Extraktion: strukturierte Felder werden aus einfachen Zeilen wie 'Title:', 'Start:' und 'End:' gelesen.",
      ],
    };
  }
}

function parseBlock(block: string, index: number): ExtractedBooking {
  const fields = parseFields(block);
  const firstLine = block.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim();
  const title = fields.title ?? fields.titel ?? firstLine ?? `Buchung ${index + 1}`;
  const type = parseType(fields.type ?? fields.art);
  const start = parseDateTime(fields.start ?? fields.von ?? fields.beginn);
  const end = parseOptionalDateTime(fields.end ?? fields.bis ?? fields.ende);

  return {
    title,
    type,
    start,
    end,
    from: parsePlace(fields.from ?? fields.vonort ?? fields["von ort"]),
    to: parsePlace(fields.to ?? fields.nach ?? fields.ziel ?? fields["zielort"]),
    travelers: parseTravelers(fields.travelers ?? fields.reisende),
    details: makeDetails(block),
  };
}

function parseFields(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]+):\s*(.+?)\s*$/);
    if (match) {
      fields[match[1].trim().toLowerCase()] = match[2].trim();
    }
  }
  return fields;
}

function parseType(value: string | undefined): BookingType {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized && bookingTypes.has(normalized as BookingType) ? (normalized as BookingType) : "other";
}

function parseDateTime(value: string | undefined): BookingDateTime {
  if (!value) {
    return {
      value: new Date().toISOString().slice(0, 10),
      precision: "date",
    };
  }

  const trimmed = value.trim();
  return {
    value: trimmed,
    precision: /t|\d{1,2}:\d{2}/i.test(trimmed) ? "datetime" : "date",
  };
}

function parseOptionalDateTime(value: string | undefined): BookingDateTime | undefined {
  return value ? parseDateTime(value) : undefined;
}

function parsePlace(value: string | undefined): BookingPlace | undefined {
  if (!value) return undefined;
  return { name: value.trim() };
}

function parseTravelers(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map((traveler) => traveler.trim())
    .filter(Boolean);
}

function makeDetails(block: string): string {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

