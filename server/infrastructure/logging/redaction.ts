const SENSITIVE_KEY = /authorization|api.?key|token|secret|password|cookie|webhook|raw.?payload/i;

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item));
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactForLog(item),
      ]),
    );
  }

  return value;
}
