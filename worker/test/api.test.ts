import { env, exports } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { buildGeneratedPlan } from "../src/plans";
import { PlanRequest } from "../src/schemas";

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

let n = 0;
async function member(label: string) {
  n += 1;
  const body = { name: `Member ${label}`, username: `member${label}${n}`, email: `m${label}${n}@example.com`, mobile: `+91987650${String(1000 + n)}`, password: "MemberPass123!" };
  const res = await api("/api/auth/register", "POST", body);
  expect(res.status).toBe(201);
  return { ...body, token: res.data.access_token as string, id: res.data.user.id as number };
}

const planPayload = { goal: "Build muscle", experience: "Beginner", days_per_week: 3, location: "Gym", equipment: "Full gym", split: "Full body", session_length: 45 };

beforeAll(async () => { await applyD1Migrations(e.DB, e.TEST_MIGRATIONS); });

describe("staff portal", () => {
  it("creates a free member login, checks in today, saves notes, and sends an in-app reminder", async () => {
    const staffLogin = await api("/api/auth/login", "POST", { identifier: "staff1", password: "FixtureStaffPass123!", expected_role: "staff_admin" });
    expect(staffLogin.status).toBe(200);
    const token = staffLogin.data.access_token as string;
    const created = await api("/api/staff/members", "POST", { name: "Floor Member", username: "floormember", email: "floormember@example.com", mobile: "+919876541234" }, token);
    expect(created.status).toBe(201);
    expect(created.data.member.role).toBe("member");
    expect(created.data.temporary_password).toMatch(/^[a-f0-9]{36}$/);
    const id = created.data.member.id;
    expect((await api("/api/staff/members", "GET", undefined, token)).data.members.some((item: any) => item.id === id && item.billing_tier === "free")).toBe(true);
    const login = await api("/api/auth/login", "POST", { identifier: "floormember", password: created.data.temporary_password, expected_role: "member" });
    expect(login.status).toBe(200);
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => date.find(item => item.type === type)?.value;
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    expect((await api(`/api/staff/members/${id}/check-in`, "PUT", { date: today }, token)).status).toBe(200);
    expect((await api(`/api/staff/members/${id}/notes`, "POST", { note: "Keep the pace controlled." }, token)).status).toBe(201);
    await e.DB.prepare("INSERT INTO body_measurements (user_id, recorded_at, height_cm, weight_kg, created_at, updated_at) VALUES (?, ?, 175, 72.4, ?, ?)").bind(id, today, `${today}T09:00:00`, `${today}T09:00:00`).run();
    const exerciseRows = (await e.DB.prepare("SELECT name FROM exercises ORDER BY name LIMIT 2").all<{ name: string }>()).results;
    expect(exerciseRows.length).toBe(2);
    const day = { workout_date: today, day: { day: "Monday", focus: "Full body", exercises: [{ name: exerciseRows[0].name, phase: "Main", sets: 3, reps: "8-12", rest_seconds: 60, substitute: "", risk_note: null }] } };
    await e.DB.prepare("INSERT INTO daily_workout_plans (user_id, workout_date, configuration_json, day_json, created_at, updated_at) VALUES (?, ?, '{}', ?, ?, ?)").bind(id, today, JSON.stringify(day), `${today}T09:00:00`, `${today}T09:00:00`).run();
    const detail = await api(`/api/staff/members/${id}`, "GET", undefined, token);
    expect(detail.data.attendance[0].status).toBe("done");
    expect(detail.data.notes[0].note).toBe("Keep the pace controlled.");
    expect(detail.data.measurements[0].weight_kg).toBe(72.4);
    expect(detail.data.daily_plan.day.exercises[0].name).toBe(exerciseRows[0].name);
    expect((await api(`/api/staff/members/${id}/swaps`, "POST", { date: today, original_name: exerciseRows[0].name, replacement_name: exerciseRows[1].name }, token)).status).toBe(200);
    const swapped = await e.DB.prepare("SELECT day_json FROM daily_workout_plans WHERE user_id = ? AND workout_date = ?").bind(id, today).first<{ day_json: string }>();
    expect(JSON.parse(swapped!.day_json).day.exercises[0].name).toBe(exerciseRows[1].name);
    expect((await api(`/api/staff/members/${id}/reminders`, "POST", undefined, token)).status).toBe(201);
    expect((await api(`/api/staff/members/${id}/reminders`, "POST", undefined, token)).status).toBe(409);
    const reminders = await api("/api/reminders", "GET", undefined, login.data.access_token);
    expect(reminders.data.reminders[0].message).toContain("membership");
    expect((await api(`/api/reminders/${reminders.data.reminders[0].id}/seen`, "PUT", undefined, login.data.access_token)).status).toBe(200);
    expect((await api("/api/reminders", "GET", undefined, login.data.access_token)).data.reminders[0].seen_at).toBeTruthy();
    expect((await api(`/api/staff/members/${id}/notes`, "POST", { note: "X" }, login.data.access_token)).status).toBe(403);
    expect((await api(`/api/admin/users/${id}/status`, "PUT", { status: "blocked" }, token)).status).toBe(422);
    const form = new FormData();
    form.set("amount", "12500");
    form.set("method", "upi");
    form.set("transaction_ref", "UTR123456789");
    form.set("collected_by_name", "Impostor");
    form.set("collected_by_username", "impostor");
    const payment = await (exports as any).default.fetch(new Request(`https://example.com/api/staff/members/${id}/payments`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form }));
    expect(payment.status).toBe(201);
    const collection = (await api("/api/staff/collections", "GET", undefined, token)).data.collections.find((item: any) => item.user_id === id);
    expect(collection.status).toBe("pending_review");
    expect(collection.amount).toBe(12500);
    expect(collection.method).toBe("upi");
    expect(collection.transaction_ref).toBe("UTR123456789");
    expect(collection.collected_by_name).toBe("SetSaathi Staff");
    expect(collection.collected_by_username).toBe("staff1");
    const recordedBy = await e.DB.prepare("SELECT collected_by, collected_by_name, collected_by_username FROM payments WHERE id = ?").bind(collection.id).first<{ collected_by: number; collected_by_name: string; collected_by_username: string }>();
    expect(recordedBy).toMatchObject({ collected_by_name: "SetSaathi Staff", collected_by_username: "staff1" });
    expect(recordedBy?.collected_by).toBe(staffLogin.data.user.id);
    const paymentRow = await e.DB.prepare("SELECT proof_r2_key FROM payments WHERE id = ?").bind(collection.id).first<{ proof_r2_key: string | null }>();
    expect(paymentRow?.proof_r2_key).toBeNull();
    const duplicate = await (exports as any).default.fetch(new Request(`https://example.com/api/staff/members/${id}/payments`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form }));
    expect(duplicate.status).toBe(409);
    const cashForm = new FormData();
    cashForm.set("amount", "5000");
    cashForm.set("method", "cash");
    const cash = await (exports as any).default.fetch(new Request(`https://example.com/api/staff/members/${id}/payments`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: cashForm }));
    expect(cash.status).toBe(201);
    expect((await api("/api/staff/collections", "GET", undefined, login.data.access_token)).status).toBe(403);
  });
});

describe("auth", () => {
  it("registers, signs in, and never exposes the password", async () => {
    const m = await member("a");
    const reg = await api("/api/auth/register", "POST", { name: "Second", username: "second1", email: "second1@example.com", mobile: "+919876509999", password: "MemberPass123!" });
    expect(reg.status).toBe(201);
    expect(reg.data.user.role).toBe("member");
    const membership = await e.DB.prepare("SELECT billing_tier, status FROM memberships WHERE user_id = ?").bind(reg.data.user.id).first<{ billing_tier: string; status: string }>();
    expect(membership).toMatchObject({ billing_tier: "free", status: "active" });
    expect(reg.text).not.toContain("MemberPass123!");
    expect(reg.text).not.toContain("password_hash");
    const login = await api("/api/auth/login", "POST", { identifier: m.username, password: m.password, expected_role: "member" });
    expect(login.status).toBe(200);
    expect(login.data.token_type).toBe("bearer");
    expect((await api("/api/auth/login", "POST", { identifier: m.email, password: "wrong-password", expected_role: "member" })).status).toBe(401);
    expect((await api("/api/auth/login", "POST", { identifier: m.mobile, password: m.password, expected_role: "member" })).status).toBe(200);
  });

  it("rejects duplicate email/mobile/username and invalid input", async () => {
    const m = await member("dup");
    const dup = await api("/api/auth/register", "POST", { name: "X Y", username: "other-name", email: m.email.toUpperCase(), mobile: "+919876500001", password: "MemberPass123!" });
    expect(dup.status).toBe(409);
    expect(dup.data.detail).toBe("An account already uses this email or mobile number.");
    expect((await api("/api/auth/register", "POST", { name: "X Y", username: "zzz1", email: "z1@example.com", mobile: m.mobile, password: "MemberPass123!" })).status).toBe(409);
    const bad = await api("/api/auth/register", "POST", { name: "X Y", username: "zzz2", email: "z2@example.com", mobile: "12345", password: "MemberPass123!" });
    expect(bad.status).toBe(422);
    expect(typeof bad.data.detail).toBe("string");
    expect((await api("/api/auth/register", "POST", { name: "X Y", username: "zzz3", email: "not-an-email", mobile: "+919876500002", password: "MemberPass123!" })).status).toBe(422);
    expect((await api("/api/auth/register", "POST", { name: "X Y", username: "zzz4", email: "z4@example.com", mobile: "+919876500003", password: "short" })).status).toBe(422);
  });

  it("stores PBKDF2 hashes, not passwords", async () => {
    const m = await member("hash");
    const row = await e.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(m.id).first<{ password_hash: string }>();
    expect(row!.password_hash.startsWith("pbkdf2_sha256$100000$")).toBe(true);
    expect(row!.password_hash).not.toContain(m.password);
  });

  it("blocks members from admin routes; the seeded admin gets in; role is checked on sign-in", async () => {
    const m = await member("role");
    expect((await api("/api/admin/health", "GET", undefined, m.token)).status).toBe(403);
    expect((await api("/api/auth/login", "POST", { identifier: m.email, password: m.password, expected_role: "admin" })).status).toBe(403);
    const admin = await api("/api/auth/login", "POST", { identifier: "administrator", password: "AdminPass123!", expected_role: "admin" });
    expect(admin.status).toBe(200);
    expect(admin.data.user.role).toBe("admin");
    const ok = await api("/api/admin/health", "GET", undefined, admin.data.access_token);
    expect(ok.status).toBe(200);
    expect(ok.data).toEqual({ status: "admin-access-confirmed" });
    expect((await api("/api/admin/health")).status).toBe(401);
  });

  it("lets the platform admin block and unblock a member, including an existing session", async () => {
    const m = await member("blocked");
    const admin = await api("/api/auth/login", "POST", { identifier: "administrator", password: "AdminPass123!", expected_role: "admin" });
    const path = `/api/admin/users/${m.id}/status`;
    expect((await api(path, "PUT", { status: "blocked" }, m.token)).status).toBe(403);
    expect((await api(path, "PUT", { status: "blocked" })).status).toBe(401);
    expect((await api(path, "PUT", { status: "invalid" }, admin.data.access_token)).status).toBe(422);
    expect((await api(path, "PUT", { status: "blocked" }, admin.data.access_token)).data.status).toBe("blocked");
    const login = await api("/api/auth/login", "POST", { identifier: m.username, password: m.password, expected_role: "member" });
    expect(login.status).toBe(403);
    expect(login.data.detail).toContain("blocked from using SetSaathi");
    const existingSession = await api("/api/plans/current", "GET", undefined, m.token);
    expect(existingSession.status).toBe(403);
    expect(existingSession.data.detail).toBe(login.data.detail);
    expect((await api("/api/auth/session", "GET", undefined, m.token)).data.detail).toBe(login.data.detail);
    expect((await api("/api/auth/login", "POST", { identifier: m.username, password: "wrong-password", expected_role: "member" })).data.detail).toBe("Invalid login details.");
    expect((await api("/api/admin/users", "GET", undefined, admin.data.access_token)).data.users.find((row: any) => row.id === m.id).status).toBe("blocked");
    expect((await api(path, "PUT", { status: "active" }, admin.data.access_token)).data.status).toBe("active");
    expect((await api("/api/auth/session", "GET", undefined, m.token)).status).toBe(200);
    expect((await api("/api/auth/login", "POST", { identifier: m.username, password: m.password, expected_role: "member" })).status).toBe(200);
  });

  it("routes staff through shared login and enforces the block hierarchy", async () => {
    const memberAccount = await member("staff-block");
    const staff = await api("/api/auth/login", "POST", { identifier: "Staff1", password: "FixtureStaffPass123!", expected_role: "staff_admin" });
    expect(staff.status).toBe(200);
    expect(staff.data.user.role).toBe("staff");
    const staffToken = staff.data.access_token as string;
    const admin = await api("/api/auth/login", "POST", { identifier: "administrator", password: "AdminPass123!", expected_role: "staff_admin" });
    expect(admin.data.user.role).toBe("admin");
    const adminToken = admin.data.access_token as string;
    expect((await api("/api/admin/workspace", "GET", undefined, staffToken)).status).toBe(403);
    expect((await api("/api/admin/users", "GET", undefined, staffToken)).data.users.every((user: any) => user.role === "member")).toBe(true);
    expect((await api(`/api/admin/users/${staff.data.user.id}/status`, "PUT", { status: "blocked" }, staffToken)).status).toBe(403);
    expect((await api(`/api/admin/users/${admin.data.user.id}/status`, "PUT", { status: "blocked" }, staffToken)).status).toBe(403);
    const blockMember = await api(`/api/admin/users/${memberAccount.id}/status`, "PUT", { status: "blocked", reason: "Access review" }, staffToken);
    expect(blockMember.status).toBe(200);
    const blocked = await api("/api/auth/me", "GET", undefined, memberAccount.token);
    expect(blocked.status).toBe(403);
    expect(blocked.data.detail).toContain("Access review");
    expect((await api(`/api/admin/users/${memberAccount.id}/status`, "PUT", { status: "active" }, staffToken)).status).toBe(200);
    expect((await api("/api/auth/me", "GET", undefined, memberAccount.token)).status).toBe(200);
    expect((await api(`/api/admin/users/${staff.data.user.id}/status`, "PUT", { status: "blocked", reason: "Shift ended" }, adminToken)).status).toBe(200);
    expect((await api("/api/auth/me", "GET", undefined, staffToken)).status).toBe(403);
    expect((await api("/api/auth/login", "POST", { identifier: "staff1", password: "FixtureStaffPass123!", expected_role: "staff_admin" })).status).toBe(403);
    expect((await api(`/api/admin/users/${admin.data.user.id}/status`, "PUT", { status: "blocked" }, adminToken)).status).toBe(403);
    expect((await api(`/api/admin/users/${staff.data.user.id}/status`, "PUT", { status: "active" }, adminToken)).status).toBe(200);
  });

  it("rejects forged and malformed tokens", async () => {
    const m = await member("forge");
    const [h, , s] = m.token.split(".");
    const forgedBody = btoa(JSON.stringify({ sub: String(m.id), role: "admin", exp: 4102444800 })).replace(/=+$/, "");
    expect((await api("/api/admin/health", "GET", undefined, `${h}.${forgedBody}.${s}`)).status).toBe(401);
    expect((await api("/api/plans/current", "GET", undefined, "garbage")).status).toBe(401);
  });
});

describe("admin gym workspace", () => {
  it("keeps each admin's roster private and validates membership dates", async () => {
    const adminLogin = await api("/api/auth/login", "POST", { identifier: "administrator", password: "AdminPass123!", expected_role: "admin" });
    const adminToken = adminLogin.data.access_token as string;
    const regular = await member("admin-roster");
    expect((await api("/api/admin/workspace", "GET", undefined, regular.token)).status).toBe(403);
    expect((await api("/api/admin/users", "GET", undefined, regular.token)).status).toBe(403);
    expect((await api("/api/auth/login", "POST", { identifier: regular.username, password: regular.password, expected_role: "member" })).status).toBe(200);
    const accounts = await api("/api/admin/users", "GET", undefined, adminToken);
    expect(accounts.status).toBe(200);
    expect(accounts.data.users.some((user: any) => user.id === regular.id && user.last_login_at)).toBe(true);
    expect(accounts.text).not.toContain("password_hash");

    const gym = { name: "Harbour Fitness", address: "12 Main Road, Mumbai", phone: "+919876543210" };
    expect((await api("/api/admin/gym", "PUT", gym, adminToken)).status).toBe(200);
    const record = { full_name: "Asha Khan", mobile: "+919111111111", email: "asha@example.com", plan_name: "Monthly", started_at: "2026-11-01", expires_at: "2026-12-01", notes: "Morning member", archived: false };
    expect((await api("/api/admin/members", "POST", { ...record, expires_at: "2026-10-31" }, adminToken)).status).toBe(422);
    const created = await api("/api/admin/members", "POST", record, adminToken);
    expect(created.status).toBe(201);
    const listed = await api("/api/admin/workspace", "GET", undefined, adminToken);
    expect(listed.data.gym.name).toBe(gym.name);
    expect(listed.data.members.some((row: any) => row.id === created.data.id && row.full_name === record.full_name)).toBe(true);

    const hash = await e.DB.prepare("SELECT password_hash FROM users WHERE username = 'administrator'").first<{ password_hash: string }>();
    await e.DB.prepare("INSERT INTO users (name, username, email, mobile, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, 'admin', ?)")
      .bind("Second Manager", "manager2", "manager2@example.com", "+919888888888", hash!.password_hash, "2026-11-24T00:00:00").run();
    const otherLogin = await api("/api/auth/login", "POST", { identifier: "manager2", password: "AdminPass123!", expected_role: "admin" });
    const otherToken = otherLogin.data.access_token as string;
    expect((await api("/api/admin/users", "GET", undefined, otherToken)).status).toBe(200);
    expect((await api(`/api/admin/users/${regular.id}/status`, "PUT", { status: "blocked" }, otherToken)).status).toBe(200);
    expect((await api(`/api/admin/users/${regular.id}/status`, "PUT", { status: "active" }, otherToken)).status).toBe(200);
    expect((await api("/api/admin/workspace", "GET", undefined, otherToken)).data.members).toEqual([]);
    expect((await api(`/api/admin/members/${created.data.id}`, "PUT", record, otherToken)).status).toBe(404);
    expect((await api(`/api/admin/members/${created.data.id}`, "PUT", { ...record, plan_name: "Quarterly" }, adminToken)).status).toBe(200);
    expect((await api("/api/admin/workspace", "GET", undefined, adminToken)).data.members.find((row: any) => row.id === created.data.id).plan_name).toBe("Quarterly");
  });
});

describe("guest (no token) access", () => {
  it("can browse the public catalogue", async () => {
    expect((await api("/health")).data).toEqual({ status: "ok" });
    const list = await api("/api/exercises?query=squat");
    expect(list.status).toBe(200);
    expect(list.data.length).toBeGreaterThan(0);
    expect(list.data[0]).toHaveProperty("license_name");
    expect(list.data[0]).toHaveProperty("gym_equipment");
    expect((await api("/api/exercises/999999")).status).toBe(404);
    expect((await api("/api/equipment")).data.length).toBeGreaterThan(0);
  });

  it("cannot call protected routes, write, or use the coach", async () => {
    const protectedCalls: [string, string, unknown?][] = [
      ["POST", "/api/coach/query", { question: "what next" }],
      ["POST", "/api/plans/generate", planPayload],
      ["GET", "/api/plans/current"],
      ["POST", "/api/plans/today", planPayload],
      ["POST", "/api/plans/today/from-current"],
      ["GET", "/api/plans/today?workout_date=2026-01-01"],
      ["PUT", "/api/workout-progress", { workout_date: "2026-01-01", workout_day: "Monday", exercise_name: "Push-up", status: "completed" }],
      ["GET", "/api/workout-progress?start=2026-01-01&end=2026-01-07"],
      ["POST", "/api/workout-events", { workout_day: "Monday", exercise_name: "Push-up", event_type: "skipped" }],
      ["PUT", "/api/gym-attendance", { workout_date: "2026-01-01", status: "completed" }],
      ["GET", "/api/gym-attendance?start=2026-01-01&end=2026-01-07"],
      ["PUT", "/api/body-measurements", { height_cm: 170, weight_kg: 70 }],
      ["GET", "/api/body-measurements"],
      ["PATCH", "/api/profile", { name: "A B", username: "abc", email: "a@b.co", mobile: "+919876500100" }],
      ["POST", "/api/membership/subscriptions", { event_type: "new", gym_name: "Gym", membership_plan: "Plan", started_at: "2026-01-01", expires_at: "2026-02-01" }],
      ["GET", "/api/me/equipment"],
      ["PUT", "/api/me/equipment", { equipment: [] }],
      ["GET", "/api/gyms/equipment"],
      ["GET", "/api/gyms/equipment/catalog"],
      ["PUT", "/api/gyms/equipment", { location: "Bandra", equipment: [] }],
      ["GET", "/api/gyms/search?area=Bandra"],
    ];
    for (const [method, path, body] of protectedCalls) {
      const res = await api(path, method, body);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });
});

describe("member data and cross-user isolation", () => {
  it("keeps progress, attendance, body data and plans private to each user", async () => {
    const a = await member("isoA"), b = await member("isoB");
    expect((await api("/api/workout-progress", "PUT", { workout_date: "2026-03-02", workout_day: "Monday", exercise_name: "Push-up", status: "completed", notes: "felt good" }, a.token)).status).toBe(200);
    const loggedSets = await api("/api/workout-sets", "PUT", { workout_date: "2026-03-02", exercise_name: "Push-up", sets: [{ set_number: 1, reps: 12, weight_kg: null }, { set_number: 2, reps: 10, weight_kg: 5 }] }, a.token);
    expect(loggedSets.status).toBe(200);
    expect(loggedSets.data).toHaveLength(2);
    expect((await api("/api/workout-sets?start=2026-03-01&end=2026-03-08", "GET", undefined, b.token)).data).toHaveLength(0);
    expect((await api("/api/gym-attendance", "PUT", { workout_date: "2026-03-02", status: "completed" }, a.token)).status).toBe(200);
    expect((await api("/api/body-measurements", "PUT", { recorded_at: "2026-03-02", height_cm: 175, weight_kg: 70 }, a.token)).data.bmi).toBe(22.9);

    const range = "start=2026-03-01&end=2026-03-08";
    expect((await api(`/api/workout-progress?${range}`, "GET", undefined, a.token)).data).toHaveLength(1);
    expect((await api(`/api/workout-progress?${range}`, "GET", undefined, b.token)).data).toHaveLength(0);
    const attA = (await api(`/api/gym-attendance?${range}`, "GET", undefined, a.token)).data;
    expect(attA.some((r: any) => r.status === "completed")).toBe(true);
    expect((await api(`/api/gym-attendance?${range}`, "GET", undefined, b.token)).data.some((r: any) => r.status === "completed")).toBe(false);
    expect((await api("/api/body-measurements", "GET", undefined, b.token)).data).toHaveLength(0);

    // Same exercise/date for B is a separate row, not an overwrite of A's.
    await api("/api/workout-progress", "PUT", { workout_date: "2026-03-02", workout_day: "Monday", exercise_name: "Push-up", status: "skipped" }, b.token);
    expect((await api(`/api/workout-progress?${range}`, "GET", undefined, a.token)).data[0].status).toBe("completed");

    const plan = await api("/api/plans/generate", "POST", planPayload, a.token);
    expect(plan.status).toBe(200);
    expect((await api("/api/plans/current", "GET", undefined, a.token)).status).toBe(200);
    expect((await api("/api/plans/current", "GET", undefined, b.token)).status).toBe(404);
  });

  it("separates gym check-in (attendance) from completed/skipped workout progress", async () => {
    const a = await member("sep");
    await api("/api/gym-attendance", "PUT", { workout_date: "2026-03-03", status: "completed" }, a.token);
    expect((await api("/api/workout-progress?start=2026-03-01&end=2026-03-08", "GET", undefined, a.token)).data).toHaveLength(0);
  });

  it("validates dates, ranges and required fields", async () => {
    const a = await member("val");
    expect((await api("/api/workout-progress?start=2026-03-08&end=2026-03-01", "GET", undefined, a.token)).status).toBe(422);
    expect((await api("/api/workout-progress?start=bad&end=2026-03-01", "GET", undefined, a.token)).status).toBe(422);
    expect((await api("/api/workout-progress", "PUT", { workout_date: "2026-03-02", workout_day: "Monday", exercise_name: "Push-up", status: "replaced" }, a.token)).data.detail).toBe("Enter the replacement exercise.");
    expect((await api("/api/workout-events", "POST", { workout_day: "Monday", exercise_name: "Push-up", event_type: "changed" }, a.token)).status).toBe(422);
    expect((await api("/api/workout-events", "POST", { workout_day: "Monday", exercise_name: "Push-up", event_type: "skipped" }, a.token)).status).toBe(201);
    expect((await api("/api/body-measurements", "PUT", { height_cm: 50, weight_kg: 70 }, a.token)).status).toBe(422);
  });

  it("answers coach questions for members using local retrieval", async () => {
    const a = await member("coach");
    const res = await api("/api/coach/query", "POST", { question: "How do I do a push-up?" }, a.token);
    expect(res.status).toBe(200);
    expect(res.data.provider).toBe("local-rag");
    expect(res.data.sources.length).toBeGreaterThan(0);
    expect((await api("/api/coach/query", "POST", { question: "How do I do a push-up?" }, a.token)).data.cached).toBe(true);
  });

  it("updates profile with duplicate protection", async () => {
    const a = await member("p1"), b = await member("p2");
    const dup = await api("/api/profile", "PATCH", { name: "New Name", username: a.username, email: b.email, mobile: b.mobile }, b.token);
    expect(dup.status).toBe(409);
    const ok = await api("/api/profile", "PATCH", { name: "New  Name", username: "newname-" + n, email: b.email, mobile: b.mobile }, b.token);
    expect(ok.status).toBe(200);
    expect(ok.data.name).toBe("New Name");
  });
});

describe("plan generation", () => {
  it("adds one warm-up and finisher within the beginner cap and preserves phase order", async () => {
    const a = await member("phases");
    const created = await api("/api/plans/generate", "POST", planPayload, a.token);
    expect(created.status).toBe(200);
    for (const phase of ["Warm-up", "Finisher"]) {
      const added = await api("/api/plans/extra", "POST", { day: "Monday", phase }, a.token);
      expect(added.status).toBe(200);
      expect(added.data.days[0].exercises.filter((item: any) => item.phase === phase)).toHaveLength(3);
      expect((await api("/api/plans/extra", "POST", { day: "Monday", phase }, a.token)).status).toBe(422);
    }
    const current = await api("/api/plans/current", "GET", undefined, a.token);
    const phases = current.data.days[0].exercises.map((item: any) => item.phase);
    expect(phases).toEqual([...phases].sort((left, right) => ["Warm-up", "Main", "Finisher"].indexOf(left) - ["Warm-up", "Main", "Finisher"].indexOf(right)));
    const names = current.data.days.flatMap((day: any) => day.exercises.map((item: any) => item.name.toLowerCase()));
    expect(new Set(names).size).toBe(names.length);
    expect((await api("/api/plans/extra", "POST", { day: "Monday", phase: "Recovery" }, a.token)).status).toBe(422);
  });

  it("keeps the selected split until the member changes it explicitly", async () => {
    const a = await member("sticky");
    const first = await api("/api/plans/type", "PUT", { split: "Push pull legs" }, a.token);
    expect(first.status).toBe(200);
    expect((await api("/api/plans/settings", "GET", undefined, a.token)).data.split).toBe("Push pull legs");
    expect((await api("/api/plans/generate", "POST", planPayload, a.token)).status).toBe(409);
    expect((await api("/api/plans/today", "POST", planPayload, a.token)).status).toBe(409);
    const changed = await api("/api/plans/type", "PUT", { split: "Muscle split" }, a.token);
    expect(changed.status).toBe(200);
    expect(changed.data.days.map((day: any) => day.focus)).toEqual(["Chest", "Back", "Legs", "Shoulders", "Arms"]);
    const newWeek = await api("/api/plans/regenerate", "POST", undefined, a.token);
    expect(newWeek.status).toBe(200);
    expect((await api("/api/plans/settings", "GET", undefined, a.token)).data.split).toBe("Muscle split");
  });

  it("rejects invalid split/day combinations", async () => {
    const a = await member("inv");
    expect((await api("/api/plans/generate", "POST", { ...planPayload, split: "Push pull legs", days_per_week: 2 }, a.token)).status).toBe(422);
    expect((await api("/api/plans/generate", "POST", { ...planPayload, split: "Upper/lower", days_per_week: 3 }, a.token)).status).toBe(422);
    expect((await api("/api/plans/generate", "POST", { ...planPayload, goal: "Nope" }, a.token)).status).toBe(422);
  });

  it("is deterministic for a given template variant and honours the 14-day rotation", async () => {
    const payload = PlanRequest.parse({ ...planPayload, split: "Push pull legs", days_per_week: 4 });
    const template = await e.DB.prepare("SELECT id, version, structure_json, pools_json FROM plan_templates WHERE experience = ? AND split = ?").bind("Beginner", "Push pull legs").first<any>();
    const variant = await e.DB.prepare("SELECT id, number, pools_json FROM plan_variants WHERE template_id = ? AND number = 3").bind(template.id).first<any>();
    const library = (await e.DB.prepare("SELECT name, primary_muscle, category, equipment, difficulty, substitute FROM exercises").all<any>()).results;
    const one = buildGeneratedPlan(payload, library, template, null, variant);
    const two = buildGeneratedPlan(payload, library, template, null, variant);
    expect(two).toEqual(one);
    expect(one.days).toHaveLength(4);
    expect(one.days.map((d) => d.focus)).toEqual(["Push", "Pull", "Legs", "Push"]);
    expect(one.days[0].exercises.filter((x) => x.phase === "Main")).toHaveLength(5);
    const names = one.days.flatMap((d) => d.exercises.map((x) => x.name.toLowerCase()));
    expect(new Set(names).size).toBe(names.length); // no exercise repeated within the week
    expect(one.rationale).toContain("variation 3");

    const a = await member("rot");
    const first = await api("/api/plans/generate", "POST", planPayload, a.token);
    expect(first.status).toBe(200);
    const second = await api("/api/plans/generate", "POST", planPayload, a.token);
    if (second.status === 200) expect(JSON.stringify(second.data.days.map((d: any) => d.exercises.map((x: any) => x.name)).flat().sort())).not.toBe(JSON.stringify(first.data.days.map((d: any) => d.exercises.map((x: any) => x.name)).flat().sort()));
    else expect(second.status).toBe(409);

    const today = await api("/api/plans/today/from-current", "POST", undefined, a.token);
    expect(today.status).toBe(200);
    expect(today.data.source).toBe("weekly-plan");
    const date = today.data.workout_date;
    expect((await api(`/api/plans/today?workout_date=${date}`, "GET", undefined, a.token)).status).toBe(200);
  });
});

describe("routing", () => {
  it("returns JSON 404/405 for unknown API routes", async () => {
    expect((await api("/api/nope")).status).toBe(404);
    expect((await api("/api/auth/login")).status).toBe(405);
  });
});
