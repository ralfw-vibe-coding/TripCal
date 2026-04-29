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
    if (request.mimeType.startsWith("text/") && request.dataBase64) {
      return { text: Buffer.from(request.dataBase64, "base64").toString("utf8") };
    }

    if (!request.mimeType.startsWith("image/") && request.mimeType !== "application/pdf") {
      throw new Error(`Unsupported text extraction mime type: ${request.mimeType}`);
    }

    const content =
      request.mimeType === "application/pdf"
        ? [
            {
              type: "input_file",
              filename: request.fileName ?? "document.pdf",
              file_data: request.contentDataUrl ?? `data:${request.mimeType};base64,${request.dataBase64}`,
            },
            { type: "input_text", text: "Extrahiere den Text aus diesem Reisedokument." },
          ]
        : [
            { type: "input_text", text: "Extrahiere den Text aus diesem Reisedokument-Bild." },
            { type: "input_image", image_url: request.contentDataUrl },
          ];

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
            content,
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
