import type { AllowedAction } from "../types.js";

export interface NotificationRecord {
  at_virtual: string;
  action: AllowedAction;
  target?: string;
  body: string;
  cited_event_ids: string[];
}

/** Record-only sink — no outbound messages in benchmark runs. */
export class NotificationSink {
  readonly records: NotificationRecord[] = [];

  record(entry: NotificationRecord): void {
    this.records.push(entry);
  }

  clear(): void {
    this.records.length = 0;
  }
}
