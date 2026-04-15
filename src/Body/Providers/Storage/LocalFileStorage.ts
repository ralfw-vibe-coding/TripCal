import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import { newId } from "../../../Shared/ids/newId.js";
import type { FileStorage, StoredFile } from "./FileStorage.js";

export class LocalFileStorage implements FileStorage {
  constructor(private readonly rootDirectory: string) {}

  async store(
    content: Uint8Array,
    options: {
      contentType: string;
      originalFileName?: string;
    }
  ): Promise<StoredFile> {
    const extension = this.getExtension(options.originalFileName, options.contentType);
    const storageKey = join("documents", `${newId()}${extension}`);
    const absolutePath = join(this.rootDirectory, storageKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);

    return { storageKey };
  }

  private getExtension(originalFileName: string | undefined, contentType: string): string {
    const originalExtension = originalFileName ? extname(basename(originalFileName)) : "";
    if (originalExtension !== "") {
      return originalExtension;
    }

    switch (contentType) {
      case "application/pdf":
        return ".pdf";
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return ".docx";
      case "text/plain":
        return ".txt";
      case "image/png":
        return ".png";
      case "image/jpeg":
        return ".jpg";
      default:
        return "";
    }
  }
}
