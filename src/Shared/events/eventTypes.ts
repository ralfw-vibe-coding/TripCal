export const eventTypes = {
  documentStored: "documentStored",
  analysisStarted: "analysisStarted",
  analysisFinished: "analysisFinished",
  analysisFailed: "analysisFailed",
  bookingRegistered: "bookingRegistered"
} as const;

export type EventType = (typeof eventTypes)[keyof typeof eventTypes];

