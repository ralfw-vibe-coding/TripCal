export type DocumentFileReference = {
  fileName: string;
};

export type DocumentFileValidationResult =
  | { status: "accepted" }
  | {
      status: "rejected";
      unsupportedFileNames: string[];
      message: string;
    };

export function validateDocumentFiles(files: DocumentFileReference[]): DocumentFileValidationResult {
  const unsupportedFileNames = files
    .map((file) => file.fileName)
    .filter((fileName) => !isSupportedDocumentFile(fileName));

  if (unsupportedFileNames.length === 0) {
    return { status: "accepted" };
  }

  return {
    status: "rejected",
    unsupportedFileNames,
    message: `Nur PDF-Dateien werden akzeptiert: ${unsupportedFileNames.join(", ")}`,
  };
}

function isSupportedDocumentFile(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith(".pdf");
}
