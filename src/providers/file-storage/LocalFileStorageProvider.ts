import { mkdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import type { IdGenerator } from "../ids/IdGenerator";
import type { FileStorageProvider, StoreFileRequest, StoreFileResponse } from "./FileStorageProvider";

export class LocalFileStorageProvider implements FileStorageProvider {
  constructor(
    private readonly rootDirectory: string,
    private readonly idGenerator: IdGenerator,
  ) {}

  async storeFile(request: StoreFileRequest): Promise<StoreFileResponse> {
    await mkdir(this.rootDirectory, { recursive: true });

    const bytes = Buffer.from(request.dataBase64, "base64");
    const storageKey = `${this.idGenerator.newId()}${sanitizeExtension(extname(request.originalFileName))}`;
    await writeFile(`${this.rootDirectory}/${storageKey}`, bytes);

    return {
      storageKey,
      sizeBytes: bytes.byteLength,
    };
  }
}

function sanitizeExtension(extension: string): string {
  return extension.match(/^\.[a-zA-Z0-9]+$/) ? extension.toLowerCase() : "";
}
