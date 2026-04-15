import type { Clock } from "./Clock.js";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

