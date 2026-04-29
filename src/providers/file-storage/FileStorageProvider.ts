export type StoreFileRequest = {
  originalFileName: string;
  mimeType: string;
  dataBase64: string;
};

export type StoreFileResponse = {
  storageKey: string;
  sizeBytes: number;
};

export interface FileStorageProvider {
  storeFile(request: StoreFileRequest): Promise<StoreFileResponse>;
}

