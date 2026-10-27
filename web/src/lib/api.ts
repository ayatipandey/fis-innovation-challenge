export class ApiError extends Error {
  status: number;
  field?: string;
  problems?: string[];
  constructor(message: string, status: number, body?: { field?: string; problems?: string[] }) {
    super(message);
    this.status = status;
    this.field = body?.field;
    this.problems = body?.problems;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function api<T>(path: string, opts: { method?: Method; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10000);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        'x-perkly-client': 'web',
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiError(
      timedOut ? 'Perkly took too long to respond. Check your connection and try again.' : 'Perkly can’t be reached. Check your connection and try again.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(data?.error ?? 'Something went wrong. Try again.', res.status, data);
  return data as T;
}

/** Local weekday (0 = Monday), hour and minute, so moments match the member's own clock. */
export function localTime(d = new Date()) {
  return { weekday: (d.getDay() + 6) % 7, hour: d.getHours(), minute: d.getMinutes() };
}

/** A fresh key per tap-sequence so a double tap can't place two holds. */
export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
