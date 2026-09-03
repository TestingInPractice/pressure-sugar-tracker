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
  /** Местные времена дня в формате "HH:MM", напр. ["08:00", "20:00"]. */
  times: string[];
}

export interface ReminderState {
  /** Локальная дата "YYYY-MM-DD", к которой относятся doneTimes. */
  day: string;
  /** Времена (HH:MM), уже отработавшие в этот день. */
  doneTimes: string[];
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

export interface SyncState {
  reportId: string;
  reportName: string;
  fields: Field[];
  entries: Entry[];
  syncedAt: number; // мс, время последней записи файла
}

/** Результат сохранения файла синхронизации. */
export type SyncFileResult =
  | { kind: 'shared' }       // отдано через Web Share
  | { kind: 'created' }      // создан новый файл (File System Access или download)
  | { kind: 'updated' }      // перезаписан тот же файл (сохранённый handle)
  | { kind: 'cancelled' };   // пользователь отменил выбор/шаринг

export interface Settings {
  masterOn: boolean;
}

export interface Snapshot {
  settings: Settings;
  reports: Report[];
  entries: Entry[];
}
