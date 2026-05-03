export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  console[level](payload);
}
