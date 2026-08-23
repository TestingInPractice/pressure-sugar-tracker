export type FieldType = 'number' | 'text' | 'datetime';

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  unit?: string;
  required: boolean;
  width: number;
}

export interface Reminder {
  enabled: boolean;
  datetime: string; // ISO 8601
}

export interface ReminderState {
  repeatsDone: number;
  lastNotifiedAt?: number;
}

export interface Report {
  id: string;
  name: string;
  fields: Field[];
  archived: boolean;
  reminder?: Reminder;
  reminderState?: ReminderState;
  createdAt: number;
  updatedAt: number;
}

export interface Entry {
  id: string;
  reportId: string;
  values: Record<string, string | number>;
  createdAt: number;
}

export interface Settings {
  masterOn: boolean;
}

export interface Snapshot {
  settings: Settings;
  reports: Report[];
  entries: Entry[];
}
