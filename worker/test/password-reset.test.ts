import { env, exports } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

const e = env as unknown as { DB: D1Database; TEST_MIGRATIONS: any[] };

async function api(path: string, method = "GET", body?: unknown) {
  const res = await (exports as any).default.fetch(new Request(`https://example.com${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, data, text };
}

beforeAll(async () => { await applyD1Migrations(e.DB, e.TEST_MIGRATIONS); });

describe("password reset", () => {
  it("does not send codes when email delivery is not configured", async () => {
    const reg = await api("/api/auth/register", "POST", { name: "Reset Person", username: "resetperson1", email: "resetperson1@example.com", mobile: "+919812300777", password: "OriginalPass123!" });
    expect(reg.status).toBe(201);
    const res = await api("/api/auth/forgot-password", "POST", { email: "resetperson1@example.com" });
    expect(res.status).toBe(503);
    expect(res.text).not.toContain("resetperson1@example.com");
  });

  it("rejects a reset attempt with no pending code, without revealing whether the account exists", async () => {
    const unknown = await api("/api/auth/reset-password", "POST", { email: "nobody@example.com", code: "123456", new_password: "NewPass12345!" });
    const known = await api("/api/auth/reset-password", "POST", { email: "resetperson1@example.com", code: "123456", new_password: "NewPass12345!" });
    expect(unknown.status).toBe(400);
    expect(known.status).toBe(400);
    expect(unknown.data.detail).toBe(known.data.detail);
  });

  it("validates the code format and the new password length", async () => {
    expect((await api("/api/auth/reset-password", "POST", { email: "resetperson1@example.com", code: "12ab", new_password: "NewPass12345!" })).status).toBe(422);
    expect((await api("/api/auth/reset-password", "POST", { email: "resetperson1@example.com", code: "123456", new_password: "short" })).status).toBe(422);
  });
});
