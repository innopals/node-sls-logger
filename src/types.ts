export interface SlsOptions {
  accessKey: string;
  accessSecret: string;
  endpoint: string;
  logstore: string;
  source?: string;
  topic?: string;
  hashkey?: string;
  compress?: boolean;
  tags?: { [key: string]: string };
}
export interface SlsLoggerOptions extends SlsOptions {
  level?: number | "ALL" | "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL" | "OFF";
  disabled?: boolean;
}

export interface LogContent {
  Key: string;
  Value: string;
}

export interface LogTag {
  Key: string;
  Value: string;
}

export interface Log {
  Time: number; // UNIX time
  Contents: LogContent[];
}

export interface LogGroup {
  Logs: Log[];
  Category?: string;
  Topic?: string;
  Source?: string;
  MachineUUID?: string;
  LogTags?: LogTag[];
}

export type LogMethod = (level: string | { name: string, level: number }, message: string | (() => string), ...extra: any[]) => any;
export type LeveledLogMethod = (message: string | (() => string), ...extra: any[]) => any;
