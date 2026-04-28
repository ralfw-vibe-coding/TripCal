import type { IdGenerator } from "./IdGenerator";

export class CryptoIdGenerator implements IdGenerator {
  newId(): string {
    return crypto.randomUUID();
  }
}

