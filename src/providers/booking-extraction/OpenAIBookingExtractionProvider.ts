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
    start?: unknown;
    end?: unknown;
    from?: unknown;
    to?: unknown;
    travelers?: unknown;
    details?: unknown;
  }>;
  warnings?: unknown;
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
          "Gib ausschließlich Daten zurück, die für einen Reisekalender nützlich sind.",
          "Strukturiere nur Titel, Art, Start, Ende, Von, Nach und Reisende.",
          "Alle weiteren Angaben wie Buchungsnummern, Flugnummern, Anbieter, Check-in, Sitzplätze oder Adressen gehören als gut lesbarer Markdown-Text in details.",
          "Verwende ISO-Strings für Datums-/Zeitwerte, möglichst inklusive Zeitzone, wenn sie im Text erkennbar ist.",
        ].join(" "),
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: request.text }],
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

    return {
      bookings: parseBookings(parsed),
      warnings: parseWarnings(parsed.warnings),
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
        value: { type: "string" },
        precision: { type: "string", enum: ["date", "datetime"] },
        timezone: { type: "string" },
      },
      required: ["value", "precision"],
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

function parseBookings(parsed: BookingExtractionJson): ExtractedBooking[] {
  return (parsed.bookings ?? []).map((booking, index): ExtractedBooking => {
    const start = parseDateTime(booking.start) ?? {
      value: new Date().toISOString().slice(0, 10),
      precision: "date",
    };

    return {
      title: parseString(booking.title) ?? `Buchung ${index + 1}`,
      type: parseBookingType(booking.type),
      start,
      end: parseDateTime(booking.end),
      from: parsePlace(booking.from),
      to: parsePlace(booking.to),
      travelers: parseStringArray(booking.travelers),
      details: parseString(booking.details) ?? "",
    };
  });
}

function parseString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseBookingType(value: unknown): BookingType {
  return typeof value === "string" && bookingTypes.includes(value as BookingType) ? (value as BookingType) : "other";
}

function parseDateTime(value: unknown): BookingDateTime | undefined {
  if (!isRecord(value)) return undefined;
  const textValue = parseString(value.value);
  if (!textValue) return undefined;
  return {
    value: textValue,
    precision: value.precision === "datetime" ? "datetime" : "date",
    timezone: parseString(value.timezone),
  };
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

function parseWarnings(value: unknown): string[] | undefined {
  const warnings = parseStringArray(value);
  return warnings.length > 0 ? warnings : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

