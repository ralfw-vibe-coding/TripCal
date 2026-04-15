export type StoredFile = {
  storageKey: string;
};

export interface FileStorage {
  store(
    content: Uint8Array,
    options: {
      contentType: string;
      originalFileName?: string;
    }
  ): Promise<StoredFile>;
}

