import type { ExtractTextRequest, ExtractTextResponse, TextExtractionProvider } from "./TextExtractionProvider";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

export class OpenAITextExtractionProvider implements TextExtractionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-5.4-mini",
  ) {}

  async extractText(request: ExtractTextRequest): Promise<ExtractTextResponse> {
    if (!request.mimeType.startsWith("image/")) {
      throw new Error(`Unsupported text extraction mime type: ${request.mimeType}`);
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        instructions: [
          "Lies den sichtbaren Text aus dem Bild.",
          "Gib nur den extrahierten Text zurück.",
          "Bewahre Zeilenumbrüche, Datumsangaben, Buchungsnummern und Tabellen möglichst sinnvoll.",
          "Erfinde keine Inhalte.",
        ].join(" "),
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extrahiere den Text aus diesem Reisedokument-Bild." },
              { type: "input_image", image_url: request.contentDataUrl },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI text extraction failed: ${response.status} ${message}`);
    }

    const body = (await response.json()) as OpenAIResponse;
    return { text: extractOutputText(body).trim() };
  }
}

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

