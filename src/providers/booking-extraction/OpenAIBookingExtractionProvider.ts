import type { BookingDateTime, BookingPlace, BookingType, ExtractedBooking } from "../../domain/model";
import type {
  BookingExtractionProvider,
  ExtractBookingsFromTextRequest,
  ExtractBookingsFromTextResponse,
} from "./BookingExtractionProvider";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

type BookingExtractionJson = {
  bookings?: Array<{
    title?: unknown;
    type?: unknown;
    serviceIdentifier?: unknown;
    operator?: unknown;
    start?: unknown;
    end?: unknown;
    from?: unknown;
    to?: unknown;
    travelers?: unknown;
    details?: unknown;
  }>;
  warnings?: unknown;
};

type DateTimeNormalization = {
  dateTime: BookingDateTime;
  warnings: string[];
};

const bookingTypes: BookingType[] = [
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
];

export class OpenAIBookingExtractionProvider implements BookingExtractionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-5.4-mini",
  ) {}

  async extractBookingsFromText(request: ExtractBookingsFromTextRequest): Promise<ExtractBookingsFromTextResponse> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        instructions: [
          "Extrahiere Reisebuchungen aus unstrukturiertem Dokumenttext.",
          "Ein Dokumenttext kann mehrere Buchungen und mehrere Buchungstypen enthalten. Bestimme type pro Buchung unabhängig.",
          "Gib ausschließlich Daten zurück, die für einen Reisekalender nützlich sind.",
          "Strukturiere title, type, serviceIdentifier, operator, start, end, from, to und travelers.",
          "serviceIdentifier ist die konkrete Service-Kennung wie Flugnummer, Zugnummer, Buslinie oder Fährlinie, z.B. LH123, ICE 789, K6843, Bus 42.",
          "operator ist das ausführende Unternehmen oder der Anbieter, z.B. Lufthansa, Deutsche Bahn, Air Cambodia, SNAV, Hertz.",
          "Für event, restaurant und activity lasse serviceIdentifier und operator weg, außer sie sind ausdrücklich sinnvoll im Text genannt.",
          "Alle weiteren Angaben wie Buchungsnummern, Check-in, Sitzplätze, Gepäck, Adressen oder Stornoregeln gehören als gut lesbarer Markdown-Text in details.",
          "Liefere start und end als Datumsteile, nicht als fertige ISO-Strings.",
          "Extrahiere bei Datums-/Zeitwerten nur Bestandteile, die ausdrücklich im Text stehen.",
          "Wenn im Text kein Jahr steht, setze date.year auf null. Erfinde niemals ein Jahr.",
          "Wenn im Text keine Uhrzeit steht, setze time auf null.",
          "Wenn eine Zeitzone oder ein UTC-Offset ausdrücklich erkennbar ist, setze timezone, sonst lasse timezone weg.",
        ].join(" "),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `Referenzjahr fuer spaetere Normalisierung: ${request.referenceYear}.`,
                  "Nutze dieses Referenzjahr nicht als extrahiertes Jahr. Wenn das Jahr im Dokument fehlt, muss date.year null bleiben.",
                  "",
                  request.text,
                ].join("\n"),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "tripcal_booking_extraction",
            strict: false,
            schema: bookingExtractionSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI booking extraction failed: ${response.status} ${message}`);
    }

    const body = (await response.json()) as OpenAIResponse;
    const parsed = JSON.parse(extractOutputText(body)) as BookingExtractionJson;
    const parsedBookings = parseBookings(parsed, request.referenceYear);

    return {
      bookings: parsedBookings.bookings,
      warnings: mergeWarnings(parseWarnings(parsed.warnings), parsedBookings.warnings),
    };
  }
}

const bookingExtractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bookings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: bookingTypes },
          serviceIdentifier: { type: "string" },
          operator: { type: "string" },
          start: { $ref: "#/$defs/dateTime" },
          end: { anyOf: [{ $ref: "#/$defs/dateTime" }, { type: "null" }] },
          from: { anyOf: [{ $ref: "#/$defs/place" }, { type: "null" }] },
          to: { anyOf: [{ $ref: "#/$defs/place" }, { type: "null" }] },
          travelers: {
            type: "array",
            items: { type: "string" },
          },
          details: { type: "string" },
        },
        required: ["title", "type", "start", "travelers", "details"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["bookings"],
  $defs: {
    dateTime: {
      type: "object",
      additionalProperties: false,
      properties: {
        sourceText: { type: "string" },
        date: {
          type: "object",
          additionalProperties: false,
          properties: {
            year: { anyOf: [{ type: "integer" }, { type: "null" }] },
            month: { type: "integer", minimum: 1, maximum: 12 },
            day: { type: "integer", minimum: 1, maximum: 31 },
          },
          required: ["year", "month", "day"],
        },
        time: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                hour: { type: "integer", minimum: 0, maximum: 23 },
                minute: { type: "integer", minimum: 0, maximum: 59 },
              },
              required: ["hour", "minute"],
            },
            { type: "null" },
          ],
        },
        timezone: { type: "string" },
      },
      required: ["sourceText", "date", "time"],
    },
    place: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        city: { type: "string" },
        country: { type: "string" },
      },
      required: ["name"],
    },
  },
};

function extractOutputText(response: OpenAIResponse): string {
  if (response.output_text) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI response did not contain output text.");
}

function parseBookings(parsed: BookingExtractionJson, referenceYear: number): { bookings: ExtractedBooking[]; warnings: string[] } {
  const warnings: string[] = [];
  const bookings = (parsed.bookings ?? []).map((booking, index): ExtractedBooking => {
    const parsedStart = parseDateTime(booking.start, referenceYear, `Buchung ${index + 1}: Start`);
    if (parsedStart) warnings.push(...parsedStart.warnings);
    const start = parsedStart?.dateTime ?? {
      value: new Date().toISOString().slice(0, 10),
      precision: "date",
    };
    const parsedEnd = parseDateTime(booking.end, referenceYear, `Buchung ${index + 1}: Ende`);
    if (parsedEnd) warnings.push(...parsedEnd.warnings);

    return {
      title: parseString(booking.title) ?? `Buchung ${index + 1}`,
      type: parseBookingType(booking.type),
      serviceIdentifier: parseString(booking.serviceIdentifier),
      operator: parseString(booking.operator),
      start,
      end: parsedEnd?.dateTime,
      from: parsePlace(booking.from),
      to: parsePlace(booking.to),
      travelers: parseStringArray(booking.travelers),
      details: parseString(booking.details) ?? "",
    };
  });
  return { bookings, warnings };
}

function parseString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseBookingType(value: unknown): BookingType {
  return typeof value === "string" && bookingTypes.includes(value as BookingType) ? (value as BookingType) : "other";
}

export function normalizeExtractedDateTime(
  value: unknown,
  referenceYear: number,
  label = "Datum",
): DateTimeNormalization | undefined {
  if (!isRecord(value)) return undefined;

  const textValue = parseString(value.value);
  if (textValue) {
    return {
      dateTime: {
        value: textValue,
        precision: value.precision === "datetime" ? "datetime" : "date",
        timezone: parseString(value.timezone),
      },
      warnings: [],
    };
  }

  const date = isRecord(value.date) ? value.date : undefined;
  const day = parseInteger(date?.day);
  const month = parseInteger(date?.month);
  const explicitYear = parseNullableInteger(date?.year);
  if (!day || !month) return undefined;

  const year = explicitYear ?? referenceYear;
  const time = isRecord(value.time) ? value.time : undefined;
  const hour = parseInteger(time?.hour);
  const minute = parseInteger(time?.minute);
  const hasTime = hour !== undefined && minute !== undefined;
  const dateValue = toDateValue(year, month, day);
  const timezone = parseString(value.timezone);
  const sourceText = parseString(value.sourceText);
  const warnings =
    explicitYear === undefined
      ? [`${label}: Jahr aus Referenzjahr ${referenceYear} ergänzt${sourceText ? ` (Quelle: ${sourceText})` : ""}.`]
      : [];

  if (!hasTime) {
    return {
      dateTime: {
        value: dateValue,
        precision: "date",
        timezone,
      },
      warnings,
    };
  }

  return {
    dateTime: {
      value: `${dateValue}T${pad2(hour)}:${pad2(minute)}:00${isOffsetTimezone(timezone) ? timezone : ""}`,
      precision: "datetime",
      timezone,
    },
    warnings,
  };
}

function parseDateTime(value: unknown, referenceYear: number, label: string): DateTimeNormalization | undefined {
  return normalizeExtractedDateTime(value, referenceYear, label);
}

function parsePlace(value: unknown): BookingPlace | undefined {
  if (!isRecord(value)) return undefined;
  const name = parseString(value.name);
  if (!name) return undefined;
  return {
    name,
    city: parseString(value.city),
    country: parseString(value.country),
  };
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => parseString(item)).filter((item): item is string => Boolean(item))
    : [];
}

function parseInteger(value: unknown): number | undefined {
  return Number.isInteger(value) ? (value as number) : undefined;
}

function parseNullableInteger(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : parseInteger(value);
}

function toDateValue(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isOffsetTimezone(value: string | undefined): boolean {
  return Boolean(value?.match(/^[+-]\d{2}:\d{2}$/));
}

function parseWarnings(value: unknown): string[] | undefined {
  const warnings = parseStringArray(value);
  return warnings.length > 0 ? warnings : undefined;
}

function mergeWarnings(...warningGroups: Array<string[] | undefined>): string[] | undefined {
  const warnings = warningGroups.flatMap((group) => group ?? []);
  return warnings.length > 0 ? warnings : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
