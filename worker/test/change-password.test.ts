import { env, exports } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

const e = env as unknown as { DB: D1Database; TEST_MIGRATIONS: any[] };

async function api(path: string, method = "GET", body?: unknown, token?: string) {
  const res = await (exports as any).default.fetch(new Request(`https://example.com${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, data, text };
}

beforeAll(async () => { await applyD1Migrations(e.DB, e.TEST_MIGRATIONS); });

describe("change password", () => {
  it("requires the current password, then the new one signs in and the old one stops working", async () => {
    const body = { name: "Pass Changer", username: "passchanger1", email: "passchanger1@example.com", mobile: "+919812300001", password: "OldPassword123!" };
    const reg = await api("/api/auth/register", "POST", body);
    expect(reg.status).toBe(201);
    const token = reg.data.access_token as string;

    expect((await api("/api/auth/change-password", "POST", { current_password: "OldPassword123!", new_password: "short" }, token)).status).toBe(422);
    expect((await api("/api/auth/change-password", "POST", { current_password: "OldPassword123!", new_password: "OldPassword123!" }, token)).status).toBe(422);
    expect((await api("/api/auth/change-password", "POST", { current_password: "WrongPassword999!", new_password: "NewPassword456!" }, token)).status).toBe(403);

    const changed = await api("/api/auth/change-password", "POST", { current_password: "OldPassword123!", new_password: "NewPassword456!" }, token);
    expect(changed.status).toBe(200);
    expect(changed.text).not.toContain("NewPassword456!");

    expect((await api("/api/auth/login", "POST", { identifier: body.username, password: "OldPassword123!", expected_role: "member" })).status).toBe(401);
    expect((await api("/api/auth/login", "POST", { identifier: body.username, password: "NewPassword456!", expected_role: "member" })).status).toBe(200);
  });

  it("rejects unauthenticated password changes", async () => {
    const res = await api("/api/auth/change-password", "POST", { current_password: "anything-here", new_password: "NewPassword456!" });
    expect(res.status).toBe(401);
  });
});
