export class HttpError extends Error {
  constructor(public status: number, public detail: string, public errors?: unknown[]) {
    super(detail);
  }
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SECRET_KEY: string;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  ALLOW_RESET_CODE_LOG?: string;
  INITIAL_ADMIN_NAME?: string;
  INITIAL_ADMIN_USERNAME?: string;
  INITIAL_ADMIN_EMAIL?: string;
  INITIAL_ADMIN_MOBILE?: string;
  INITIAL_ADMIN_PASSWORD?: string;
  INITIAL_STAFF_PASSWORD?: string;
  INITIAL_STAFF_EMAIL?: string;
  INITIAL_STAFF_MOBILE?: string;
  ACCESS_TOKEN_MINUTES?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  SITE_URL?: string;
  GYM_LOOKUP_URL?: string;
  GYM_LOOKUP_USER_AGENT?: string;
}

export const nowIso = (): string => new Date().toISOString().slice(0, -1); // naive UTC, like the Python API
export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday, like Python's date.weekday(). */
export function weekday(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
