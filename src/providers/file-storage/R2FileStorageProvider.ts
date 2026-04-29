import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { extname } from "node:path";
import type { IdGenerator } from "../ids/IdGenerator";
import type { FileStorageProvider, StoreFileRequest, StoreFileResponse } from "./FileStorageProvider";

export type R2FileStorageProviderConfig = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
};

export class R2FileStorageProvider implements FileStorageProvider {
  private readonly client: S3Client;

  constructor(
    private readonly config: R2FileStorageProviderConfig,
    private readonly idGenerator: IdGenerator,
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async storeFile(request: StoreFileRequest): Promise<StoreFileResponse> {
    const bytes = Buffer.from(request.dataBase64, "base64");
    const storageKey = `${this.idGenerator.newId()}${sanitizeExtension(extname(request.originalFileName))}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
        Body: bytes,
        ContentType: request.mimeType,
      }),
    );

    return {
      storageKey,
      sizeBytes: bytes.byteLength,
    };
  }

  async readFile(storageKey: string): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
      }),
    );

    if (!response.Body) {
      throw new Error(`R2 object has no body: ${storageKey}`);
    }

    return response.Body.transformToByteArray();
  }
}

function sanitizeExtension(extension: string): string {
  return extension.match(/^\.[a-zA-Z0-9]+$/) ? extension.toLowerCase() : "";
}
