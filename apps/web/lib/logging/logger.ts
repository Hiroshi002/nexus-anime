import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(messageLevel: LogLevel): boolean {
  const configLevel: LogLevel =
    (process.env.LOG_LEVEL as LogLevel) ||
    (process.env.NODE_ENV === "production" ? "info" : "debug");
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[configLevel];
}

function formatEntry(
  level: LogLevel,
  message: string,
  context: Record<string, unknown>,
): LogEntry {
  return { timestamp: new Date().toISOString(), level, message, ...context };
}

function output(entry: LogEntry): void {
  const json = JSON.stringify(entry);
  switch (entry.level) {
    case "error":
      console.error(json);
      break;
    case "warn":
      console.warn(json);
      break;
    default:
      console.log(json);
      break;
  }
}

export const logger = {
  debug(message: string, context: Record<string, unknown> = {}): void {
    if (!shouldLog("debug")) return;
    output(formatEntry("debug", message, context));
  },
  info(message: string, context: Record<string, unknown> = {}): void {
    if (!shouldLog("info")) return;
    output(formatEntry("info", message, context));
  },
  warn(message: string, context: Record<string, unknown> = {}): void {
    if (!shouldLog("warn")) return;
    output(formatEntry("warn", message, context));
  },
  error(message: string, context: Record<string, unknown> = {}): void {
    if (!shouldLog("error")) return;
    output(formatEntry("error", message, context));
  },
};
