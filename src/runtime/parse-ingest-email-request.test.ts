import { describe, expect, it } from "vitest";
import { parseIngestEmailRequest } from "../../netlify/functions/_shared/ingest-email-request";

describe("parseIngestEmailRequest", () => {
  it("parses multipart email metadata and file attachments", async () => {
    const formData = new FormData();
    formData.set(
      "email",
      JSON.stringify({
        messageId: "message-1#attachment_0",
        from: "Andrea <andrea@example.com>",
        subject: "Ticket",
        receivedAt: "2026-05-04T06:55:47.000Z",
      }),
    );
    formData.set("attachment", new File([Buffer.from("ticket")], "ticket.pdf", { type: "application/pdf" }));

    const request = new Request("https://tripcal.example/api/ingest-email-background", {
      method: "POST",
      body: formData,
    });

    await expect(parseIngestEmailRequest(request)).resolves.toEqual({
      messageId: "message-1#attachment_0",
      from: "Andrea <andrea@example.com>",
      subject: "Ticket",
      receivedAt: "2026-05-04T06:55:47.000Z",
      text: undefined,
      attachments: [
        {
          fileName: "ticket.pdf",
          mimeType: "application/pdf",
          dataBase64: Buffer.from("ticket").toString("base64"),
        },
      ],
    });
  });
});
