// SetSaathi API as a Cloudflare Worker + D1. Port of backend/app/main.py.
import { answerCoach } from "./coach";
import { GYM_EQUIPMENT_GROUPS, GYM_EQUIPMENT_NAMES, requirementsFor } from "./equipment";
import { buildGeneratedPlan, planExerciseSignature, type GeneratedPlan, type LibraryItem, type PlanDay, type PlanExercise, type TemplateRow, type VariantRow } from "./plans";
import * as S from "./schemas";
import { DUMMY_HASH, hashPassword, requireSecret, sha256Hex, signJwt, verifyJwt, verifyPassword } from "./security";
import { resetMailConfigured, sendResetCode } from "./mail";
import { HttpError, addDays, dayDiff, json, nowIso, round1, todayIso, weekday, WEEKDAY_NAMES, type Env } from "./util";

interface UserRow {
  id: number; name: string; username: string | null; email: string; mobile: string; password_hash: string; role: string; status: string; is_blocked: number; blocked_reason: string | null; blocked_by: number | null; blocked_at: string | null;
  gym_name: string; gym_location: string | null; gym_place_ref: string | null; gym_place_name: string | null; membership_plan: string;
  membership_started_at: string | null; membership_expires_at: string | null; height_cm: number | null; weight_kg: number | null; bmi: number | null; created_at: string; last_login_at: string | null;
}

const BLOCKED_MESSAGE = "Your account has been blocked from using SetSaathi. Contact setsaathi@gmail.com for help.";
const blockedMessage = (user: UserRow) => user.blocked_reason ? `${BLOCKED_MESSAGE} Reason: ${user.blocked_reason}` : BLOCKED_MESSAGE;

const publicUser = (u: UserRow) => ({
  id: u.id, name: u.name, username: u.username, email: u.email, mobile: u.mobile, role: u.role, gym_name: u.gym_name, membership_plan: u.membership_plan,
  membership_started_at: u.membership_started_at, membership_expires_at: u.membership_expires_at, height_cm: u.height_cm, weight_kg: u.weight_kg, bmi: u.bmi, created_at: u.created_at,
});

// ---------- auth ----------
let adminChecked = false;
export async function ensureAdmin(env: Env): Promise<void> {
  if (adminChecked) return;
  if (env.INITIAL_ADMIN_PASSWORD && env.INITIAL_ADMIN_EMAIL && env.INITIAL_ADMIN_MOBILE && !await env.DB.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").first()) {
    const now = nowIso();
    const hash = await hashPassword(env.INITIAL_ADMIN_PASSWORD);
    await env.DB.prepare("INSERT OR IGNORE INTO users (name, username, email, mobile, password_hash, role, membership_plan, created_at) VALUES (?, ?, ?, ?, ?, 'admin', 'Administrator', ?)")
      .bind(env.INITIAL_ADMIN_NAME || "SetSaathi Admin", (env.INITIAL_ADMIN_USERNAME || "administrator").trim().toLowerCase(), env.INITIAL_ADMIN_EMAIL.trim().toLowerCase(), env.INITIAL_ADMIN_MOBILE, hash, now).run();
  }
  if (env.INITIAL_STAFF_PASSWORD && !await env.DB.prepare("SELECT id FROM users WHERE username = 'staff1' LIMIT 1").first()) {
    const hash = await hashPassword(env.INITIAL_STAFF_PASSWORD);
    await env.DB.prepare("INSERT OR IGNORE INTO users (name, username, email, mobile, password_hash, role, membership_plan, created_at) VALUES ('SetSaathi Staff', 'staff1', ?, ?, ?, 'staff', 'Staff', ?)")
      .bind(env.INITIAL_STAFF_EMAIL || "staff1@setsaathi.example.com", env.INITIAL_STAFF_MOBILE || "+919000000001", hash, nowIso()).run();
  }
  adminChecked = true;
}
export const resetAdminCheck = () => { adminChecked = false; };

async function authenticate(req: Request, env: Env): Promise<UserRow> {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) throw new HttpError(401, "Authentication required.");
  const payload = await verifyJwt(header.slice(7), requireSecret(env.SECRET_KEY));
  const id = payload ? Number(payload.sub) : NaN;
  if (!payload || !Number.isInteger(id)) throw new HttpError(401, "Invalid or expired session.");
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  if (!user) throw new HttpError(401, "Active account required.");
  if (user.is_blocked === 1 || user.status === "blocked") throw new HttpError(403, blockedMessage(user));
  return user;
}
async function requireMember(req: Request, env: Env): Promise<UserRow> {
  const user = await authenticate(req, env);
  if (user.role !== "member" || user.status !== "active") throw new HttpError(403, "Member access required.");
  return user;
}
async function requireAdmin(req: Request, env: Env): Promise<UserRow> {
  const user = await authenticate(req, env);
  if (user.role !== "admin" || user.status !== "active") throw new HttpError(403, "Admin access required.");
  return user;
}
async function requireStaffOrAdmin(req: Request, env: Env): Promise<UserRow> {
  const user = await authenticate(req, env);
  if (!(["staff", "admin"].includes(user.role)) || user.status !== "active") throw new HttpError(403, "Staff or admin access required.");
  return user;
}
async function requirePlatformAdmin(req: Request, env: Env): Promise<UserRow> {
  const admin = await requireAdmin(req, env);
  if (admin.username?.toLowerCase() !== (env.INITIAL_ADMIN_USERNAME || "administrator").trim().toLowerCase()
    || admin.email.toLowerCase() !== (env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase()) {
    throw new HttpError(403, "Platform administrator access required.");
  }
  return admin;
}

async function authResponse(env: Env, user: UserRow, status = 200): Promise<Response> {
  const minutes = Number(env.ACCESS_TOKEN_MINUTES) || 30;
  const token = await signJwt({ sub: String(user.id), role: user.role }, requireSecret(env.SECRET_KEY), minutes * 60);
  return json({ access_token: token, token_type: "bearer", user: publicUser(user) }, status);
}

async function readBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 200_000) throw new HttpError(413, "Request body too large.");
  try { return JSON.parse(text); } catch { throw new HttpError(422, "Request body must be valid JSON."); }
}

// ---------- helpers ----------
const first = <T>(env: Env, sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args).first<T>();
const all = async <T>(env: Env, sql: string, ...args: unknown[]) => (await env.DB.prepare(sql).bind(...args).all<T>()).results;
const isUnique = (e: unknown) => /UNIQUE|constraint/i.test(String((e as Error)?.message));

function range(url: URL, max: number, message: string, required: boolean): [string | null, string | null] {
  const sp = url.searchParams.get("start"), ep = url.searchParams.get("end");
  const start = required || sp !== null ? S.parseDate(sp, "start") : null;
  const end = required || ep !== null ? S.parseDate(ep, "end") : null;
  if (start && end && (end < start || dayDiff(start, end) > max)) throw new HttpError(422, message);
  return [start, end];
}

const bmiOf = (h: number, w: number) => w / ((h / 100) ** 2);
const bodyResponse = (m: { id: number; recorded_at: string; height_cm: number; weight_kg: number }) => ({ id: m.id, recorded_at: m.recorded_at, height_cm: round1(m.height_cm), weight_kg: round1(m.weight_kg), bmi: round1(bmiOf(m.height_cm, m.weight_kg)) });

// ---------- plans ----------
async function selectedTemplate(env: Env, p: S.PlanRequestT): Promise<TemplateRow & { id: number }> {
  const t = await first<TemplateRow>(env, "SELECT id, version, structure_json, pools_json FROM plan_templates WHERE experience = ? AND split = ? AND published = 1 ORDER BY version DESC LIMIT 1", p.experience, p.split);
  if (!t) throw new HttpError(503, "No published workout template matches these settings.");
  return t;
}
async function shuffledVariants(env: Env, templateId: number): Promise<VariantRow[]> {
  const v = await all<VariantRow>(env, "SELECT id, number, pools_json FROM plan_variants WHERE template_id = ? AND published = 1", templateId);
  if (!v.length) throw new HttpError(503, "No published plan variations are available.");
  for (let i = v.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [v[i], v[j]] = [v[j], v[i]];
  }
  return v;
}
const loadLibrary = (env: Env) => all<LibraryItem>(env, "SELECT name, primary_muscle, category, equipment, difficulty, substitute FROM exercises");

async function selectedEquipment(env: Env, user: UserRow): Promise<Set<string> | null> {
  // Gym inventories are informational; only explicit personal selections can filter home workouts.
  const rows = await all<{ equipment: string }>(env, "SELECT equipment FROM user_equipment WHERE user_id = ?", user.id);
  return rows.length ? new Set(rows.map((r) => r.equipment.toLowerCase())) : null;
}

const cutoffIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, -1);
const rotationError = () => new HttpError(409, "No different plan is available within your 14-day rotation. Add suitable equipment, change your plan settings, or try again after the rotation window.");

async function generatePlan(env: Env, user: UserRow, p: S.PlanRequestT) {
  const template = await selectedTemplate(env, p);
  const library = await loadLibrary(env);
  const equipment = await selectedEquipment(env, user);
  const cutoff = cutoffIso(14);
  const recent = new Set((await all<{ exercise_signature: string }>(env, "SELECT exercise_signature FROM plan_assignments WHERE user_id = ? AND assigned_at >= ?", user.id, cutoff)).map((r) => r.exercise_signature));
  const current = await first<{ plan_json: string; updated_at: string }>(env, "SELECT plan_json, updated_at FROM workout_plans WHERE user_id = ?", user.id);
  if (current && current.updated_at >= cutoff) recent.add(await planExerciseSignature((JSON.parse(current.plan_json) as GeneratedPlan).days));
  let lastError: HttpError | null = null, compatible = false;
  for (const variant of await shuffledVariants(env, template.id)) {
    let plan: GeneratedPlan;
    try { plan = buildGeneratedPlan(p, library, template, equipment, variant); } catch (e) {
      if (e instanceof HttpError && e.status === 422) { lastError = e; continue; }
      throw e;
    }
    const signature = await planExerciseSignature(plan.days);
    compatible = true;
    if (!recent.has(signature)) return { plan, template, variant, signature };
  }
  if (lastError && !compatible) throw lastError;
  throw rotationError();
}

async function saveDailyPlan(env: Env, user: UserRow, date: string, p: S.PlanRequestT, day: PlanDay, source: string) {
  const result = { workout_date: date, title: `Today's ${day.focus} workout`, rationale: `A dated ${p.experience.toLowerCase()} session for ${p.goal.toLowerCase()} without changing the weekly plan.`, source, day };
  const now = nowIso();
  await env.DB.prepare("INSERT INTO daily_workout_plans (user_id, workout_date, source, configuration_json, day_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, workout_date) DO UPDATE SET source = excluded.source, configuration_json = excluded.configuration_json, day_json = excluded.day_json, updated_at = excluded.updated_at")
    .bind(user.id, date, source, JSON.stringify(p), JSON.stringify(result), now, now).run();
  return result;
}

// ---------- gyms ----------
const gymKey = (name: string, location: string, ref?: string | null) => ref ? `osm::${ref}` : `${name.split(/\s+/).filter(Boolean).join(" ").toLowerCase()}::${location.split(/\s+/).filter(Boolean).join(" ").toLowerCase()}`;
const clean = (v: string) => v.split(/\s+/).filter(Boolean).join(" ");

async function placeFromToken(env: Env, token: string, gymName: string): Promise<{ ref: string; name: string; address: string }> {
  const payload = await verifyJwt(token, requireSecret(env.SECRET_KEY));
  if (!payload || payload.purpose !== "gym-place" || payload.gym_name !== gymName) throw new HttpError(422, "Gym listing expired or changed. Search again.");
  return payload as unknown as { ref: string; name: string; address: string };
}

async function gymEquipmentResponse(env: Env, user: UserRow, location?: string | null, placeToken?: string | null) {
  const selected = clean(location ?? user.gym_location ?? "");
  if (!selected) return { gym_name: user.gym_name, location: null, equipment: [] as string[], listed_name: null, place_ref: null };
  const place = placeToken ? await placeFromToken(env, placeToken, user.gym_name) : null;
  if (place && selected !== place.address) throw new HttpError(422, "The selected listing and address differ. Search again.");
  const ref = place ? place.ref : selected === user.gym_location ? user.gym_place_ref : null;
  const rows = await all<{ equipment: string }>(env, "SELECT equipment FROM gym_equipment_reports WHERE gym_key = ?", gymKey(user.gym_name, selected, ref));
  const shared = [...new Set(rows.map((r) => r.equipment).filter((e) => GYM_EQUIPMENT_NAMES.has(e)))].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return { gym_name: user.gym_name, location: selected, equipment: shared, listed_name: place ? place.name : ref ? user.gym_place_name : null, place_ref: ref ?? null };
}

const geoCache = new Map<string, { at: number; value: unknown }>();
let lastGeo = 0;
async function searchGym(env: Env, name: string, area: string): Promise<{ ref: string; name: string; address: string }[]> {
  const query = clean(`${name} ${area}`);
  const key = query.toLowerCase();
  const hit = geoCache.get(key);
  let records: any[];
  if (hit && Date.now() - hit.at < 86_400_000) records = hit.value as any[];
  else {
    const wait = 1100 - (Date.now() - lastGeo);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGeo = Date.now();
    const url = new URL(env.GYM_LOOKUP_URL || "https://nominatim.openstreetmap.org/search");
    for (const [k, v] of Object.entries({ q: query, format: "jsonv2", addressdetails: "1", namedetails: "1", limit: "5" })) url.searchParams.set(k, v);
    const res = await fetch(url, { headers: { "User-Agent": env.GYM_LOOKUP_USER_AGENT || "SetSaathi/0.1 (user-initiated gym lookup)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("lookup failed");
    records = (await res.json()) as any[];
    if (geoCache.size >= 256) geoCache.delete(geoCache.keys().next().value as string);
    geoCache.set(key, { at: Date.now(), value: records });
  }
  const places: { ref: string; name: string; address: string }[] = [];
  for (const item of records) {
    if (!["node", "way", "relation"].includes(item.osm_type) || !Number.isInteger(item.osm_id)) continue;
    const display = item.display_name ?? "";
    const listed = item.name || item.namedetails?.name || display.split(",")[0];
    if (!display || !listed) continue;
    places.push({ ref: `${item.osm_type}:${item.osm_id}`, name: listed, address: display });
  }
  return places;
}

// ---------- routes ----------
type Ctx = { req: Request; env: Env; url: URL; params: string[] };
type Handler = (c: Ctx) => Promise<Response>;
const routes: [string, RegExp, Handler][] = [];
const route = (method: string, path: string, h: Handler) => routes.push([method, new RegExp(`^${path.replace(/\{id\}/, "([^/]+)")}$`), h]);

route("GET", "/health", async () => json({ status: "ok" }));

route("GET", "/api/exercises", async ({ env, url }) => {
  const where: string[] = [], args: unknown[] = [];
  for (const [param, col] of [["muscle", "primary_muscle"], ["equipment", "equipment"], ["difficulty", "difficulty"], ["category", "category"]] as const) {
    const v = url.searchParams.get(param);
    if (v) { where.push(`${col} = ?`); args.push(v); }
  }
  const q = url.searchParams.get("query");
  if (q) { where.push("name LIKE ?"); args.push(`%${q.trim()}%`); }
  const rows = await all<Record<string, unknown> & { name: string; equipment: string }>(env, `SELECT * FROM exercises ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY name`, ...args);
  return json(rows.map((r) => ({ ...r, gym_equipment: requirementsFor(r) ? [...requirementsFor(r)!].sort() : null })));
});
route("GET", "/api/exercises/{id}", async ({ env, params }) => {
  if (!/^-?\d+$/.test(params[0])) throw new HttpError(422, "exercise_id: Input should be a valid integer");
  const r = await first<{ name: string; equipment: string }>(env, "SELECT * FROM exercises WHERE id = ?", Number(params[0]));
  if (!r) throw new HttpError(404, "Exercise not found.");
  const req = requirementsFor(r);
  return json({ ...r, gym_equipment: req ? [...req].sort() : null });
});

route("GET", "/api/equipment", async ({ env }) => {
  const rows = await all<{ equipment: string }>(env, "SELECT DISTINCT equipment FROM exercises");
  return json(rows.map((r) => r.equipment).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
});

route("POST", "/api/coach/query", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.CoachQuestionRequest, await readBody(req));
  return json(await answerCoach(env, user.id, p.question, new URL(req.url).origin));
});

route("GET", "/api/gyms/equipment", async ({ req, env, url }) => {
  const user = await requireMember(req, env);
  const location = url.searchParams.get("location");
  if (location !== null) { const n = clean(location).length; if (n < 2 || n > 300) throw new HttpError(422, "Enter the gym's address or branch."); }
  return json(await gymEquipmentResponse(env, user, location, url.searchParams.get("place_token")));
});
route("GET", "/api/gyms/search", async ({ req, env, url }) => {
  const user = await requireMember(req, env);
  const raw = url.searchParams.get("area");
  if (raw === null) throw new HttpError(422, "area: Field required");
  const area = clean(raw);
  if (user.gym_name === "Independent member" || area.length < 3 || area.length > 120) throw new HttpError(422, "Add a gym membership and enter an area or address.");
  let places;
  try { places = await searchGym(env, user.gym_name, area); } catch { throw new HttpError(503, "Gym lookup is temporarily unavailable. You can still enter the address manually."); }
  const out = [];
  for (const place of places) {
    if (place.address.length > 300) continue;
    out.push({ ...place, token: await signJwt({ ...place, gym_name: user.gym_name, purpose: "gym-place" }, requireSecret(env.SECRET_KEY), 1800) });
  }
  return json(out);
});
route("GET", "/api/gyms/equipment/catalog", async ({ req, env }) => { await requireMember(req, env); return json(GYM_EQUIPMENT_GROUPS); });
route("PUT", "/api/gyms/equipment", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.GymEquipmentUpdate, await readBody(req));
  if (!user.gym_name || user.gym_name === "Independent member") throw new HttpError(422, "Add your gym membership before recording its equipment.");
  const selected = [...new Set(p.equipment)];
  if (!selected.every((e) => GYM_EQUIPMENT_NAMES.has(e))) throw new HttpError(422, "Choose specific gym equipment from the checklist.");
  const place = p.place_token ? await placeFromToken(env, p.place_token, user.gym_name) : null;
  if (place && place.address !== p.location) throw new HttpError(422, "The selected listing and address differ. Search again.");
  const ref = place ? place.ref : p.location === user.gym_location ? user.gym_place_ref : null;
  const key = gymKey(user.gym_name, p.location, ref);
  const placeName = place ? place.name : ref ? user.gym_place_name : null;
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM gym_equipment_reports WHERE gym_key = ?").bind(key),
    env.DB.prepare("UPDATE users SET gym_location = ?, gym_place_ref = ?, gym_place_name = ? WHERE id = ?").bind(p.location, ref ?? null, placeName ?? null, user.id),
    ...selected.sort().map((e) => env.DB.prepare("INSERT INTO gym_equipment_reports (gym_key, user_id, equipment, updated_at) VALUES (?, ?, ?, ?)").bind(key, user.id, e, now)),
  ]);
  const fresh = (await first<UserRow>(env, "SELECT * FROM users WHERE id = ?", user.id))!;
  return json(await gymEquipmentResponse(env, fresh));
});

route("GET", "/api/me/equipment", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const rows = await all<{ equipment: string }>(env, "SELECT equipment FROM user_equipment WHERE user_id = ?", user.id);
  return json({ equipment: rows.map((r) => r.equipment).sort() });
});
route("PUT", "/api/me/equipment", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.EquipmentSelection, await readBody(req));
  const catalog = new Set((await all<{ equipment: string }>(env, "SELECT DISTINCT equipment FROM exercises")).map((r) => r.equipment));
  const selected = [...new Set(p.equipment)];
  if (!selected.every((e) => catalog.has(e))) throw new HttpError(422, "Choose equipment from the exercise library list.");
  selected.sort();
  await env.DB.batch([env.DB.prepare("DELETE FROM user_equipment WHERE user_id = ?").bind(user.id), ...selected.map((e) => env.DB.prepare("INSERT INTO user_equipment (user_id, equipment) VALUES (?, ?)").bind(user.id, e))]);
  return json({ equipment: selected });
});

const PLAN_TYPE_DAYS: Record<S.PlanRequestT["split"], number> = { "Full body": 3, "Upper/lower": 4, "Push pull legs": 3, "Muscle split": 5 };

async function storeWeeklyPlan(env: Env, user: UserRow, p: S.PlanRequestT) {
  const { plan, template, variant, signature } = await generatePlan(env, user, p);
  const now = nowIso(), cfg = JSON.stringify(p), body = JSON.stringify(plan);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workout_plans (user_id, configuration_json, plan_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET configuration_json = excluded.configuration_json, plan_json = excluded.plan_json, updated_at = excluded.updated_at").bind(user.id, cfg, body, now, now),
    env.DB.prepare("INSERT INTO plan_assignments (user_id, template_id, variant_id, exercise_signature, configuration_json, plan_json, assigned_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(user.id, template.id, variant.id, signature, cfg, body, now),
  ]);
  return plan;
}
route("POST", "/api/plans/generate", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.PlanRequest, await readBody(req));
  const saved = await first<{ configuration_json: string }>(env, "SELECT configuration_json FROM workout_plans WHERE user_id = ?", user.id);
  if (saved && S.PlanRequest.parse(JSON.parse(saved.configuration_json)).split !== p.split) throw new HttpError(409, "Change your plan type explicitly before generating another split.");
  return json(await storeWeeklyPlan(env, user, p));
});
route("GET", "/api/plans/settings", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const saved = await first<{ configuration_json: string }>(env, "SELECT configuration_json FROM workout_plans WHERE user_id = ?", user.id);
  if (!saved) throw new HttpError(404, "Choose a workout plan type first.");
  return json(S.PlanRequest.parse(JSON.parse(saved.configuration_json)));
});
route("PUT", "/api/plans/type", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const { split } = S.parse(S.PlanTypeRequest, await readBody(req));
  const saved = await first<{ configuration_json: string; plan_json: string }>(env, "SELECT configuration_json, plan_json FROM workout_plans WHERE user_id = ?", user.id);
  if (saved && S.PlanRequest.parse(JSON.parse(saved.configuration_json)).split === split) return json(JSON.parse(saved.plan_json));
  const previous = saved ? S.PlanRequest.parse(JSON.parse(saved.configuration_json)) : S.PlanRequest.parse({ goal: "Build muscle", experience: "Beginner", days_per_week: 3, location: "Gym", equipment: "Full gym", split, session_length: 45 });
  return json(await storeWeeklyPlan(env, user, { ...previous, split, days_per_week: PLAN_TYPE_DAYS[split] }));
});
route("POST", "/api/plans/regenerate", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const saved = await first<{ configuration_json: string }>(env, "SELECT configuration_json FROM workout_plans WHERE user_id = ?", user.id);
  if (!saved) throw new HttpError(404, "Choose a workout plan type first.");
  return json(await storeWeeklyPlan(env, user, S.PlanRequest.parse(JSON.parse(saved.configuration_json))));
});
route("GET", "/api/plans/current", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const saved = await first<{ plan_json: string }>(env, "SELECT plan_json FROM workout_plans WHERE user_id = ?", user.id);
  if (!saved) throw new HttpError(404, "No workout plan has been created yet.");
  return json(JSON.parse(saved.plan_json));
});
route("POST", "/api/plans/extra", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const body = await readBody(req) as { day?: unknown; phase?: unknown };
  if (typeof body.day !== "string" || !WEEKDAY_NAMES.slice(0, 6).includes(body.day)) throw new HttpError(422, "Choose a training day.");
  const phase = body.phase ?? "Main";
  if (phase !== "Warm-up" && phase !== "Main" && phase !== "Finisher") throw new HttpError(422, "Choose a valid exercise phase.");
  const saved = await first<{ configuration_json: string; plan_json: string }>(env, "SELECT configuration_json, plan_json FROM workout_plans WHERE user_id = ?", user.id);
  if (!saved) throw new HttpError(404, "Create a weekly plan first.");
  const config = S.PlanRequest.parse(JSON.parse(saved.configuration_json));
  const plan = JSON.parse(saved.plan_json) as GeneratedPlan;
  const day = plan.days.find((d) => d.day === body.day);
  if (!day) throw new HttpError(422, "This day is not in your plan.");
  const template = await selectedTemplate(env, config);
  const structure = JSON.parse(template.structure_json) as { warmup: number; main: number; finisher: number };
  const baseCount = phase === "Warm-up" ? structure.warmup : phase === "Finisher" ? structure.finisher : structure.main;
  const extrasAllowed = phase === "Main" ? 5 : config.experience === "Beginner" ? 1 : config.experience === "Intermediate" ? 2 : 3;
  const inPhase = day.exercises.filter((e) => e.phase === phase);
  if (inPhase.length >= baseCount + extrasAllowed) throw new HttpError(422, `Your ${config.experience.toLowerCase()} plan allows up to ${baseCount + extrasAllowed} ${phase.toLowerCase()} exercises per day.`);
  const mains = day.exercises.filter((e) => e.phase === "Main");
  const library = await loadLibrary(env);
  const byName = new Map(library.map((e) => [e.name.toLowerCase(), e]));
  const muscles = new Set(mains.map((e) => byName.get(e.name.toLowerCase())?.primary_muscle).filter(Boolean));
  const used = new Set(plan.days.flatMap((d) => d.exercises.map((e) => e.name.toLowerCase())));
  const levels = config.experience === "Beginner" ? ["beginner"] : config.experience === "Intermediate" ? ["beginner", "intermediate"] : ["beginner", "intermediate", "expert"];
  const spineSensitive = new Set(["Barbell Back Squat", "Dumbbell Romanian Deadlift", "Goblet Squat", "Leg Press"]);
  const allowedHome = config.equipment === "Dumbbells" ? ["dumbbell", "bodyweight", "body only", "bands", "none", "bench"] : ["bodyweight", "body only", "none"];
  const categories = phase === "Warm-up" ? ["stretching", "cardio"] : phase === "Finisher" ? ["cardio", "plyometrics", "strongman"] : ["strength", "powerlifting", "olympic weightlifting"];
  const eligible = (e: LibraryItem, requireHomeEquipment: boolean) => !used.has(e.name.toLowerCase()) && levels.includes(e.difficulty.toLowerCase()) && categories.includes(e.category.toLowerCase()) && (phase !== "Main" || muscles.has(e.primary_muscle)) && (config.spine_safety !== "Avoid spinal loading" || !spineSensitive.has(e.name)) && (!requireHomeEquipment || config.location === "Gym" || allowedHome.includes(e.equipment.toLowerCase()));
  let candidates = library.filter((e) => eligible(e, true));
  if (!candidates.length && phase === "Finisher") candidates = library.filter((e) => eligible(e, false));
  candidates.sort((a, b) => a.name.localeCompare(b.name));
  if (!candidates.length) throw new HttpError(422, `No more unique ${phase.toLowerCase()} exercises fit this week. Try a different training day.`);
  const chosen = candidates[0], example = inPhase[0];
  const extra: PlanExercise = { name: chosen.name, phase, sets: example?.sets ?? (phase === "Main" ? 3 : 1), reps: example?.reps ?? (phase === "Finisher" ? "30–45 sec" : "8–12 controlled reps"), rest_seconds: example?.rest_seconds ?? (phase === "Finisher" ? 30 : 20), substitute: chosen.substitute || "Choose another related exercise", risk_note: spineSensitive.has(chosen.name) ? "Keep a controlled, pain-free range and stop if this movement causes discomfort." : null };
  const nextPhase = phase === "Warm-up" ? "Main" : "Finisher";
  const index = phase === "Finisher" ? -1 : day.exercises.findIndex((e) => e.phase === nextPhase);
  const at = index < 0 ? day.exercises.length : index;
  day.exercises.splice(at, 0, extra);
  const today = todayIso();
  const daily = body.day === WEEKDAY_NAMES[weekday(today)] ? await first<{ source: string; day_json: string }>(env, "SELECT source, day_json FROM daily_workout_plans WHERE user_id = ? AND workout_date = ?", user.id, today) : null;
  const batch = [env.DB.prepare("UPDATE workout_plans SET plan_json = ?, updated_at = ? WHERE user_id = ?").bind(JSON.stringify(plan), nowIso(), user.id)];
  if (daily?.source === "weekly-plan") {
    const current = JSON.parse(daily.day_json) as { day: PlanDay };
    const dailyIndex = phase === "Finisher" ? -1 : current.day.exercises.findIndex((e) => e.phase === nextPhase);
    current.day.exercises.splice(dailyIndex < 0 ? current.day.exercises.length : dailyIndex, 0, extra);
    batch.push(env.DB.prepare("UPDATE daily_workout_plans SET day_json = ?, updated_at = ? WHERE user_id = ? AND workout_date = ?").bind(JSON.stringify(current), nowIso(), user.id, today));
  }
  await env.DB.batch(batch);
  return json(plan);
});
route("POST", "/api/plans/today", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.PlanRequest, await readBody(req));
  const savedWeekly = await first<{ configuration_json: string }>(env, "SELECT configuration_json FROM workout_plans WHERE user_id = ?", user.id);
  if (savedWeekly && S.PlanRequest.parse(JSON.parse(savedWeekly.configuration_json)).split !== p.split) throw new HttpError(409, "Today's plan must use your selected plan type.");
  const date = todayIso();
  const template = await selectedTemplate(env, p);
  const library = await loadLibrary(env);
  const equipment = await selectedEquipment(env, user);
  const previous = await all<{ day_json: string }>(env, "SELECT day_json FROM daily_workout_plans WHERE user_id = ? AND workout_date >= ?", user.id, addDays(date, -14));
  const recent = new Set<string>();
  for (const r of previous) recent.add(await planExerciseSignature([(JSON.parse(r.day_json) as { day: PlanDay }).day]));
  let selected: PlanDay | null = null, lastError: HttpError | null = null, compatible = false;
  for (const variant of await shuffledVariants(env, template.id)) {
    let generated: GeneratedPlan;
    try { generated = buildGeneratedPlan(p, library, template, equipment, variant); } catch (e) {
      if (e instanceof HttpError && e.status === 422) { lastError = e; continue; }
      throw e;
    }
    compatible = true;
    if (!recent.has(await planExerciseSignature([generated.days[0]]))) { selected = generated.days[0]; break; }
  }
  if (!selected) {
    if (lastError && !compatible) throw lastError;
    throw new HttpError(409, "No different session is available within your 14-day rotation. Change your plan settings or try again later.");
  }
  return json(await saveDailyPlan(env, user, date, p, { day: WEEKDAY_NAMES[weekday(date)], focus: selected.focus, exercises: selected.exercises }, "custom-today"));
});
route("POST", "/api/plans/today/from-current", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const saved = await first<{ configuration_json: string; plan_json: string }>(env, "SELECT configuration_json, plan_json FROM workout_plans WHERE user_id = ?", user.id);
  if (!saved) throw new HttpError(404, "Create a weekly plan first.");
  const p = S.PlanRequest.parse(JSON.parse(saved.configuration_json));
  const weekly = JSON.parse(saved.plan_json) as GeneratedPlan;
  const date = todayIso(), dayName = WEEKDAY_NAMES[weekday(date)];
  // Optional body: { source_day } lets a member shift the split sequence and do a missed day's workout today.
  const raw = await req.text();
  const body = (raw.trim() ? JSON.parse(raw) : {}) as { source_day?: unknown };
  const sourceName = typeof body.source_day === "string" ? body.source_day : null;
  const sourceDay = sourceName ? weekly.days.find((d) => d.day === sourceName) : undefined;
  if (sourceName && !sourceDay) throw new HttpError(422, "That day is not in your plan.");
  const selected = sourceDay ?? weekly.days.find((d) => d.day === dayName) ?? weekly.days[weekday(date) % weekly.days.length];
  return json(await saveDailyPlan(env, user, date, p, { day: dayName, focus: selected.focus, exercises: selected.exercises }, "weekly-plan"));
});
route("GET", "/api/plans/today", async ({ req, env, url }) => {
  const user = await requireMember(req, env);
  const date = S.parseDate(url.searchParams.get("workout_date"), "workout_date");
  const saved = await first<{ day_json: string }>(env, "SELECT day_json FROM daily_workout_plans WHERE user_id = ? AND workout_date = ?", user.id, date);
  if (!saved) throw new HttpError(404, "No dated workout plan exists for this day.");
  return json(JSON.parse(saved.day_json));
});

route("POST", "/api/workout-events", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.WorkoutEventRequest, await readBody(req));
  if (p.event_type === "changed" && !p.replacement_name) throw new HttpError(422, "A replacement exercise is required when changing an exercise.");
  const r = await env.DB.prepare("INSERT INTO workout_events (user_id, workout_day, exercise_name, event_type, replacement_name, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(user.id, p.workout_day, p.exercise_name, p.event_type, p.replacement_name ?? null, nowIso()).run();
  return json({ id: r.meta.last_row_id, event_type: p.event_type, exercise_name: p.exercise_name, replacement_name: p.replacement_name ?? null }, 201);
});

route("PUT", "/api/workout-progress", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.WorkoutProgressRequest, await readBody(req));
  if (p.status === "replaced" && !p.replacement_name) throw new HttpError(422, "Enter the replacement exercise.");
  await env.DB.prepare("INSERT INTO workout_progress (user_id, workout_date, workout_day, exercise_name, status, replacement_name, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, workout_date, exercise_name) DO UPDATE SET workout_day = excluded.workout_day, status = excluded.status, replacement_name = excluded.replacement_name, notes = excluded.notes, updated_at = excluded.updated_at")
    .bind(user.id, p.workout_date, p.workout_day, p.exercise_name, p.status, p.replacement_name ?? null, p.notes, nowIso()).run();
  return json(await first(env, "SELECT id, workout_date, workout_day, exercise_name, status, replacement_name, notes, updated_at FROM workout_progress WHERE user_id = ? AND workout_date = ? AND exercise_name = ?", user.id, p.workout_date, p.exercise_name));
});
route("GET", "/api/workout-progress", async ({ req, env, url }) => {
  const user = await requireMember(req, env);
  const [start, end] = range(url, 370, "Choose a valid date range of up to 370 days.", true);
  return json(await all(env, "SELECT id, workout_date, workout_day, exercise_name, status, replacement_name, notes, updated_at FROM workout_progress WHERE user_id = ? AND workout_date >= ? AND workout_date <= ? ORDER BY workout_date DESC, id", user.id, start, end));
});

route("PUT", "/api/workout-sets", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.WorkoutSetsRequest, await readBody(req));
  const statements = [env.DB.prepare("DELETE FROM workout_sets WHERE user_id = ? AND workout_date = ? AND exercise_name = ?").bind(user.id, p.workout_date, p.exercise_name)];
  for (const item of p.sets) statements.push(env.DB.prepare("INSERT INTO workout_sets (user_id, workout_date, exercise_name, set_number, reps, weight_kg, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(user.id, p.workout_date, p.exercise_name, item.set_number, item.reps, item.weight_kg, nowIso()));
  await env.DB.batch(statements);
  return json(await all(env, "SELECT id, workout_date, exercise_name, set_number, reps, weight_kg, updated_at FROM workout_sets WHERE user_id = ? AND workout_date = ? AND exercise_name = ? ORDER BY set_number", user.id, p.workout_date, p.exercise_name));
});
route("GET", "/api/workout-sets", async ({ req, env, url }) => {
  const user = await requireMember(req, env);
  const [start, end] = range(url, 370, "Choose a valid date range of up to 370 days.", true);
  return json(await all(env, "SELECT id, workout_date, exercise_name, set_number, reps, weight_kg, updated_at FROM workout_sets WHERE user_id = ? AND workout_date >= ? AND workout_date <= ? ORDER BY workout_date DESC, exercise_name, set_number", user.id, start, end));
});

route("PUT", "/api/gym-attendance", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.GymAttendanceRequest, await readBody(req));
  const now = nowIso();
  await env.DB.prepare("INSERT INTO gym_attendance (user_id, workout_date, status, source, created_at, updated_at) VALUES (?, ?, ?, 'manual', ?, ?) ON CONFLICT(user_id, workout_date) DO UPDATE SET status = excluded.status, source = 'manual', updated_at = excluded.updated_at").bind(user.id, p.workout_date, p.status, now, now).run();
  return json(await first(env, "SELECT id, workout_date, status, source FROM gym_attendance WHERE user_id = ? AND workout_date = ?", user.id, p.workout_date));
});
route("GET", "/api/gym-attendance", async ({ req, env, url }) => {
  const user = await requireMember(req, env);
  const [start, end] = range(url, 370, "Choose a valid date range of up to 370 days.", true);
  const records = await all<{ id: number; workout_date: string; status: string; source: string }>(env, "SELECT id, workout_date, status, source FROM gym_attendance WHERE user_id = ? AND workout_date >= ? AND workout_date <= ? ORDER BY workout_date", user.id, start, end);
  const have = new Set(records.map((r) => r.workout_date));
  const merged = [...records];
  for (let d = start!; d <= end!; d = addDays(d, 1)) if (weekday(d) === 6 && !have.has(d)) merged.push({ id: 0, workout_date: d, status: "rest", source: "system" });
  return json(merged.sort((a, b) => (a.workout_date < b.workout_date ? -1 : a.workout_date > b.workout_date ? 1 : 0)));
});

route("PUT", "/api/body-measurements", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.BodyMeasurementRequest, await readBody(req));
  const now = nowIso();
  await env.DB.prepare("INSERT INTO body_measurements (user_id, recorded_at, height_cm, weight_kg, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, recorded_at) DO UPDATE SET height_cm = excluded.height_cm, weight_kg = excluded.weight_kg, updated_at = excluded.updated_at").bind(user.id, p.recorded_at, p.height_cm, p.weight_kg, now, now).run();
  const current = await first<{ height_cm: number; weight_kg: number }>(env, "SELECT height_cm, weight_kg FROM body_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1", user.id);
  if (current) await env.DB.prepare("UPDATE users SET height_cm = ?, weight_kg = ?, bmi = ? WHERE id = ?").bind(current.height_cm, current.weight_kg, round1(bmiOf(current.height_cm, current.weight_kg)), user.id).run();
  return json(bodyResponse((await first<any>(env, "SELECT id, recorded_at, height_cm, weight_kg FROM body_measurements WHERE user_id = ? AND recorded_at = ?", user.id, p.recorded_at))!));
});
route("GET", "/api/body-measurements", async ({ req, env, url }) => {
  const user = await requireMember(req, env);
  const [start, end] = range(url, 730, "Choose a valid date range of up to two years.", false);
  const where = ["user_id = ?"], args: unknown[] = [user.id];
  if (start) { where.push("recorded_at >= ?"); args.push(start); }
  if (end) { where.push("recorded_at <= ?"); args.push(end); }
  const rows = await all<any>(env, `SELECT id, recorded_at, height_cm, weight_kg FROM body_measurements WHERE ${where.join(" AND ")} ORDER BY recorded_at`, ...args);
  return json(rows.map(bodyResponse));
});

route("PATCH", "/api/profile", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.ProfileUpdateRequest, await readBody(req));
  const dup = await first(env, "SELECT id FROM users WHERE id != ? AND (username = ? OR email = ? OR mobile = ?)", user.id, p.username, p.email, p.mobile);
  const conflict = new HttpError(409, "That username, email, or mobile number is already in use.");
  if (dup) throw conflict;
  try { await env.DB.prepare("UPDATE users SET name = ?, username = ?, email = ?, mobile = ? WHERE id = ?").bind(p.name, p.username, p.email, p.mobile, user.id).run(); } catch (e) { if (isUnique(e)) throw conflict; throw e; }
  return json(publicUser((await first<UserRow>(env, "SELECT * FROM users WHERE id = ?", user.id))!));
});

route("POST", "/api/membership/subscriptions", async ({ req, env }) => {
  const user = await requireMember(req, env);
  const p = S.parse(S.MembershipSubscriptionRequest, await readBody(req));
  const started = `${p.started_at}T00:00:00`, expires = `${p.expires_at}T00:00:00`;
  if (expires <= started) throw new HttpError(422, "Expiry date must be after the membership start date.");
  const reset = user.gym_name.toLowerCase() !== p.gym_name.toLowerCase();
  const membershipState = p.expires_at < staffToday() ? "expired" : p.expires_at <= addDays(staffToday(), 14) ? "expiring" : "active";
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET gym_name = ?, membership_plan = ?, membership_started_at = ?, membership_expires_at = ?${reset ? ", gym_location = NULL, gym_place_ref = NULL, gym_place_name = NULL" : ""} WHERE id = ?`).bind(p.gym_name, p.membership_plan, started, expires, user.id),
    env.DB.prepare("INSERT INTO membership_events (user_id, event_type, gym_name, membership_plan, started_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(user.id, p.event_type, p.gym_name, p.membership_plan, started, expires, nowIso()),
    env.DB.prepare("UPDATE memberships SET status = ?, expiry_date = ?, updated_at = ? WHERE id = (SELECT MAX(id) FROM memberships WHERE user_id = ?)").bind(membershipState, p.expires_at, nowIso(), user.id),
  ]);
  return json({ ...publicUser((await first<UserRow>(env, "SELECT * FROM users WHERE id = ?", user.id))!), event_type: p.event_type }, 201);
});

route("POST", "/api/auth/register", async ({ req, env }) => {
  const p = S.parse(S.RegisterRequest, await readBody(req));
  const conflict = new HttpError(409, "An account already uses this email or mobile number.");
  if (await first(env, "SELECT id FROM users WHERE email = ? OR mobile = ? OR username = ?", p.email, p.mobile, p.username)) throw conflict;
  const now = new Date();
  const hash = await hashPassword(p.password);
  const startedAt = now.toISOString().slice(0, -1);
  const expiresAt = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, -1);
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (name, username, email, mobile, password_hash, role, membership_started_at, membership_expires_at, created_at) VALUES (?, ?, ?, ?, ?, 'member', ?, ?, ?)").bind(p.name, p.username, p.email, p.mobile, hash, startedAt, expiresAt, startedAt),
      env.DB.prepare("INSERT INTO memberships (user_id, billing_tier, status, expiry_date, due_balance, created_at, updated_at) SELECT id, 'free', 'active', ?, 0, ?, ? FROM users WHERE username = ?").bind(expiresAt.slice(0, 10), startedAt, startedAt, p.username),
    ]);
  } catch (e) { if (isUnique(e)) throw conflict; throw e; }
  return authResponse(env, (await first<UserRow>(env, "SELECT * FROM users WHERE email = ?", p.email))!, 201);
});
route("POST", "/api/auth/forgot-password", async ({ req, env }) => {
  const p = S.parse(S.ForgotPasswordRequest, await readBody(req));
  // Check configuration before any account lookup, so the reply never depends on whether the email exists.
  if (!resetMailConfigured(env) && env.ALLOW_RESET_CODE_LOG !== "true") throw new HttpError(503, "Password reset email is not configured yet.");
  const user = await first<UserRow>(env, "SELECT * FROM users WHERE email = ?", p.email);
  if (user && user.status === "active") {
    const recent = await first<{ id: number }>(env, "SELECT id FROM password_resets WHERE user_id = ? AND created_at > ?", user.id, new Date(Date.now() - 60_000).toISOString());
    if (!recent) {
      const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      const now = new Date();
      const hash = await sha256Hex(`${user.id}:${code}:${requireSecret(env.SECRET_KEY)}`);
      await env.DB.batch([
        env.DB.prepare("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL").bind(now.toISOString(), user.id),
        env.DB.prepare("INSERT INTO password_resets (user_id, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, 0, ?)").bind(user.id, hash, new Date(now.getTime() + 10 * 60_000).toISOString(), now.toISOString()),
      ]);
      try {
        await sendResetCode(env, user.email, user.name, code);
      } catch (error) {
        // Keep the reply identical so a mail failure cannot reveal which accounts exist.
        console.error("password reset email failed", error instanceof Error ? error.message : "unknown error");
      }
    }
  }
  return json({ status: "sent", message: "If an account uses that email, a 6-digit code has been sent." });
});
route("POST", "/api/auth/reset-password", async ({ req, env }) => {
  const p = S.parse(S.ResetPasswordRequest, await readBody(req));
  const invalid = new HttpError(400, "That code is invalid or has expired. Request a new code.");
  const user = await first<UserRow>(env, "SELECT * FROM users WHERE email = ? AND status = 'active'", p.email);
  if (!user) throw invalid;
  const row = await first<{ id: number; code_hash: string; attempts: number }>(env,
    "SELECT id, code_hash, attempts FROM password_resets WHERE user_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
    user.id, new Date().toISOString());
  if (!row || row.attempts >= 5) throw invalid;
  const hash = await sha256Hex(`${user.id}:${p.code}:${requireSecret(env.SECRET_KEY)}`);
  if (hash !== row.code_hash) {
    await env.DB.prepare("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
    throw invalid;
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(p.new_password), user.id),
    env.DB.prepare("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL").bind(now, user.id),
  ]);
  return json({ status: "password-reset" });
});
route("POST", "/api/auth/change-password", async ({ req, env }) => {
  const user = await authenticate(req, env);
  const p = S.parse(S.ChangePasswordRequest, await readBody(req));
  if (!(await verifyPassword(p.current_password, user.password_hash))) throw new HttpError(403, "Your current password is not correct.");
  if (p.current_password === p.new_password) throw new HttpError(422, "Choose a new password that is different from the current one.");
  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(p.new_password), user.id).run();
  return json({ status: "password-updated" });
});
route("POST", "/api/auth/login", async ({ req, env }) => {
  const p = S.parse(S.LoginRequest, await readBody(req));
  const user = await first<UserRow>(env, "SELECT * FROM users WHERE email = ? OR mobile = ? OR username = ?", p.identifier, p.identifier, p.identifier);
  const ok = await verifyPassword(p.password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Invalid login details.");
  if (user.is_blocked === 1 || user.status === "blocked") throw new HttpError(403, blockedMessage(user));
  if (user.status !== "active") throw new HttpError(401, "Invalid login details.");
  if (p.expected_role === "staff_admin" ? !["staff", "admin"].includes(user.role) : user.role !== p.expected_role) throw new HttpError(403, "This account does not have access to that sign-in area.");
  try {
    await env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(nowIso(), user.id).run();
  } catch (error) {
    // Older D1 databases can still authenticate while migration 0005 is pending.
    if (!/no such column:\s*last_login_at/i.test(String(error))) throw error;
  }
  return authResponse(env, user);
});
route("GET", "/api/auth/session", async ({ req, env }) => {
  const user = await authenticate(req, env);
  return json({ user: publicUser(user) });
});
route("GET", "/api/auth/me", async ({ req, env }) => {
  const user = await authenticate(req, env);
  return json({ user: publicUser(user) });
});
route("GET", "/api/admin/health", async ({ req, env }) => { await requireAdmin(req, env); return json({ status: "admin-access-confirmed" }); });

route("GET", "/api/admin/users", async ({ req, env }) => {
  const actor = await requireStaffOrAdmin(req, env);
  const users = await all(env, `SELECT id, name, username, email, mobile, role, gym_name, membership_plan, membership_started_at, membership_expires_at, created_at, last_login_at, status, is_blocked, blocked_reason, blocked_by, blocked_at FROM users WHERE role IN (${actor.role === "admin" ? "'member', 'staff'" : "'member'"}) ORDER BY created_at DESC, id DESC`);
  return json({ users });
});
route("PUT", "/api/admin/users/{id}/status", async ({ req, env, params }) => {
  const actor = await requireStaffOrAdmin(req, env);
  const id = Number(params[0]);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, "Account not found.");
  const { status, reason } = S.parse(S.AdminUserStatusRequest, await readBody(req));
  const target = await first<UserRow>(env, "SELECT * FROM users WHERE id = ?", id);
  if (!target) throw new HttpError(404, "Account not found.");
  if (target.role === "admin" || (actor.role === "staff" && target.role !== "member") || actor.id === target.id) throw new HttpError(403, "You cannot change this account's access.");
  const blocked = status === "blocked";
  if (actor.role === "staff" && blocked && !reason?.trim()) throw new HttpError(422, "Enter a reason before blocking a member.");
  await env.DB.prepare("UPDATE users SET status = ?, is_blocked = ?, blocked_reason = ?, blocked_by = ?, blocked_at = ? WHERE id = ?")
    .bind(status, blocked ? 1 : 0, blocked ? reason || null : null, blocked ? actor.id : null, blocked ? nowIso() : null, id).run();
  return json({ id, status, is_blocked: blocked ? 1 : 0, blocked_reason: blocked ? reason || null : null });
});

// Staff work always targets registered member accounts in the shared D1 database.
const staffMember = async (env: Env, rawId: string) => {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, "Member not found.");
  const member = await first<UserRow>(env, "SELECT * FROM users WHERE id = ? AND role = 'member'", id);
  if (!member) throw new HttpError(404, "Member not found.");
  return member;
};
const textField = (value: unknown, label: string, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new HttpError(422, `${label} is required (up to ${max} characters).`);
  return value.trim();
};
const staffToday = () => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (name: string) => parts.find(part => part.type === name)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

route("POST", "/api/staff/members", async ({ req, env }) => {
  await requireStaffOrAdmin(req, env);
  const input = await readBody(req) as Record<string, unknown>;
  const name = textField(input.name, "Name", 120);
  const username = textField(input.username, "Username", 40).toLowerCase();
  const email = textField(input.email, "Email", 254).toLowerCase();
  const mobile = textField(input.mobile, "Mobile", 30);
  if (!/^[a-z0-9_.-]{3,40}$/.test(username) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(422, "Enter a valid username and email.");
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const password = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const hash = await hashPassword(password);
  const now = nowIso(), start = staffToday();
  try {
    const [created] = await env.DB.batch([
      env.DB.prepare("INSERT INTO users (name, username, email, mobile, password_hash, role, membership_plan, membership_started_at, created_at) VALUES (?, ?, ?, ?, ?, 'member', 'SetSaathi Starter', ?, ?)").bind(name, username, email, mobile, hash, start, now),
      env.DB.prepare("INSERT INTO memberships (user_id, billing_tier, status, due_balance, created_at, updated_at) SELECT id, 'free', 'active', 0, ?, ? FROM users WHERE username = ?").bind(now, now, username),
    ]);
    const id = Number(created.meta.last_row_id);
    return json({ member: publicUser(await staffMember(env, String(id))), temporary_password: password }, 201);
  } catch (error) { if (isUnique(error)) throw new HttpError(409, "Username, email, or mobile is already registered."); throw error; }
});

route("GET", "/api/staff/members", async ({ req, env }) => {
  await requireStaffOrAdmin(req, env);
  const members = await all(env, `SELECT u.id, u.name, u.username, u.email, u.mobile, u.gym_name, u.status, u.is_blocked,
    u.membership_expires_at, m.id AS membership_id, m.billing_tier, m.expiry_date, m.due_balance,
    (SELECT MAX(workout_date) FROM gym_attendance a WHERE a.user_id = u.id AND a.status = 'done') AS last_check_in
    FROM users u LEFT JOIN memberships m ON m.id = (SELECT MAX(id) FROM memberships WHERE user_id = u.id)
    WHERE u.role = 'member' ORDER BY u.name COLLATE NOCASE`);
  return json({ members });
});

route("GET", "/api/staff/members/{id}", async ({ req, env, params }) => {
  await requireStaffOrAdmin(req, env);
  const member = await staffMember(env, params[0]);
  const [attendance, measurements, plan, dailyPlan, membership, notes, swaps] = await Promise.all([
    all(env, "SELECT workout_date, status, source FROM gym_attendance WHERE user_id = ? AND workout_date >= ? ORDER BY workout_date DESC", member.id, addDays(staffToday(), -365)),
    all<{ id: number; recorded_at: string; height_cm: number; weight_kg: number }>(env, "SELECT id, recorded_at, height_cm, weight_kg FROM body_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 24", member.id),
    first<{ plan_json: string; configuration_json: string }>(env, "SELECT plan_json, configuration_json FROM workout_plans WHERE user_id = ?", member.id),
    first<{ workout_date: string; day_json: string }>(env, "SELECT workout_date, day_json FROM daily_workout_plans WHERE user_id = ? AND workout_date = ? LIMIT 1", member.id, staffToday()),
    first(env, "SELECT id, billing_tier, status, expiry_date, due_balance FROM memberships WHERE user_id = ? ORDER BY id DESC LIMIT 1", member.id),
    all(env, "SELECT n.id, n.note, n.created_at, u.name AS author_name FROM trainer_notes n JOIN users u ON u.id = n.author_id WHERE n.member_id = ? ORDER BY n.id DESC LIMIT 20", member.id),
    all(env, "SELECT workout_date, original_name, replacement_name, created_at FROM trainer_exercise_swaps WHERE member_id = ? ORDER BY id DESC LIMIT 20", member.id),
  ]);
  return json({ member: publicUser(member), attendance, measurements: measurements.map(bodyResponse), plan: plan ? JSON.parse(plan.plan_json) : null, daily_plan: dailyPlan ? { workout_date: dailyPlan.workout_date, ...JSON.parse(dailyPlan.day_json) } : null, membership, notes, swaps });
});

route("PUT", "/api/staff/members/{id}/check-in", async ({ req, env, params }) => {
  await requireStaffOrAdmin(req, env);
  const member = await staffMember(env, params[0]);
  if (member.is_blocked || member.status === "blocked") throw new HttpError(409, "Unblock this member before check-in.");
  const input = await readBody(req) as Record<string, unknown>;
  const date = S.parseDate(typeof input.date === "string" ? input.date : null, "date");
  if (date !== staffToday()) throw new HttpError(422, "Front-desk check-in is for today only.");
  const now = nowIso();
  await env.DB.prepare("INSERT INTO gym_attendance (user_id, workout_date, status, source, created_at, updated_at) VALUES (?, ?, 'done', 'staff', ?, ?) ON CONFLICT(user_id, workout_date) DO UPDATE SET status = 'done', source = 'staff', updated_at = excluded.updated_at")
    .bind(member.id, date, now, now).run();
  return json({ id: member.id, date, status: "done" });
});

route("POST", "/api/staff/members/{id}/notes", async ({ req, env, params }) => {
  const actor = await requireStaffOrAdmin(req, env), member = await staffMember(env, params[0]);
  const input = await readBody(req) as Record<string, unknown>;
  const note = textField(input.note, "Trainer note", 1000);
  await env.DB.prepare("INSERT INTO trainer_notes (member_id, author_id, note, created_at) VALUES (?, ?, ?, ?)").bind(member.id, actor.id, note, nowIso()).run();
  return json({ saved: true }, 201);
});

route("POST", "/api/staff/members/{id}/swaps", async ({ req, env, params }) => {
  const actor = await requireStaffOrAdmin(req, env), member = await staffMember(env, params[0]);
  const input = await readBody(req) as Record<string, unknown>;
  const date = S.parseDate(typeof input.date === "string" ? input.date : null, "date");
  const original = textField(input.original_name, "Current exercise", 120);
  const replacement = textField(input.replacement_name, "Replacement exercise", 120);
  if (original === replacement) throw new HttpError(422, "Choose a different exercise.");
  const replacementExercise = await first<{ substitute: string }>(env, "SELECT substitute FROM exercises WHERE name = ?", replacement);
  if (!replacementExercise) throw new HttpError(422, "Choose an exercise from the library.");
  const saved = await first<{ day_json: string }>(env, "SELECT day_json FROM daily_workout_plans WHERE user_id = ? AND workout_date = ?", member.id, date);
  if (!saved) throw new HttpError(409, "This member has no generated plan for that date.");
  const payload = JSON.parse(saved.day_json) as { day?: { exercises?: Array<{ name: string; substitute?: string; risk_note?: string | null }> } };
  const exercise = payload.day?.exercises?.find(item => item.name === original);
  if (!exercise) throw new HttpError(422, "The selected exercise is not in that day's plan.");
  if (payload.day?.exercises?.some(item => item.name === replacement)) throw new HttpError(422, "That exercise is already in the day's plan.");
  exercise.name = replacement;
  exercise.substitute = replacementExercise.substitute;
  exercise.risk_note = null;
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare("UPDATE daily_workout_plans SET day_json = ?, updated_at = ? WHERE user_id = ? AND workout_date = ?").bind(JSON.stringify(payload), now, member.id, date),
    env.DB.prepare("INSERT INTO trainer_exercise_swaps (member_id, author_id, workout_date, original_name, replacement_name, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(member.id, actor.id, date, original, replacement, now),
  ]);
  return json({ date, original_name: original, replacement_name: replacement });
});

route("POST", "/api/staff/members/{id}/payments", async ({ req, env, params }) => {
  const actor = await requireStaffOrAdmin(req, env), member = await staffMember(env, params[0]);
  let form: FormData;
  try { form = await req.formData(); }
  catch { throw new HttpError(422, "Send a valid payment form."); }
  const amount = Number(form.get("amount"));
  const method = form.get("method");
  const transactionRef = String(form.get("transaction_ref") || "").trim();
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000) throw new HttpError(422, "Enter a valid amount in paise.");
  if (method !== "cash" && method !== "upi") throw new HttpError(422, "Choose cash or UPI.");
  if (method === "upi" && (!/^[A-Za-z0-9-]{6,64}$/.test(transactionRef))) throw new HttpError(422, "Enter a valid UTR or transaction ID (6–64 letters, numbers, or hyphens).");
  if (method === "cash" && transactionRef) throw new HttpError(422, "A transaction ID is only used for online payments.");
  if (method === "upi" && await first(env, "SELECT id FROM payments WHERE transaction_ref = ? LIMIT 1", transactionRef)) throw new HttpError(409, "This transaction ID is already recorded.");
  const membership = await first<{ id: number }>(env, "SELECT id FROM memberships WHERE user_id = ? ORDER BY id DESC LIMIT 1", member.id);
  if (!membership) throw new HttpError(409, "This member has no membership record.");
  const result = await env.DB.prepare("INSERT INTO payments (membership_id, user_id, amount, status, method, transaction_ref, collected_by, collected_by_name, collected_by_username, created_at) VALUES (?, ?, ?, 'pending_review', ?, ?, ?, ?, ?, ?)")
    .bind(membership.id, member.id, amount, method, method === "upi" ? transactionRef : null, actor.id, actor.name, actor.username, nowIso()).run();
  return json({ id: result.meta.last_row_id, status: "pending_review" }, 201);
});

route("GET", "/api/staff/collections", async ({ req, env }) => {
  const actor = await requireStaffOrAdmin(req, env);
  const collections = await all(env, "SELECT p.id, p.user_id, u.name AS member_name, p.amount, p.method, p.transaction_ref, p.status, p.created_at, p.collected_by, COALESCE(p.collected_by_name, collector.name) AS collected_by_name, COALESCE(p.collected_by_username, collector.username) AS collected_by_username FROM payments p JOIN users u ON u.id = p.user_id LEFT JOIN users collector ON collector.id = p.collected_by WHERE p.collected_by = ? ORDER BY p.id DESC LIMIT 100", actor.id);
  return json({ collections });
});

route("POST", "/api/staff/members/{id}/reminders", async ({ req, env, params }) => {
  await requireStaffOrAdmin(req, env);
  const member = await staffMember(env, params[0]);
  if (member.is_blocked || member.status === "blocked") throw new HttpError(409, "Unblock this member before sending a reminder.");
  const membership = await first<{ id: number; expiry_date: string | null }>(env, "SELECT id, expiry_date FROM memberships WHERE user_id = ? ORDER BY id DESC LIMIT 1", member.id);
  if (!membership) throw new HttpError(409, "This member has no membership record.");
  const localMidnightUtc = new Date(`${staffToday()}T00:00:00+05:30`).toISOString().slice(0, -1);
  if (await first(env, "SELECT id FROM reminders WHERE user_id = ? AND channel = 'in_app' AND trigger_type = 'manual' AND created_at >= ? LIMIT 1", member.id, localMidnightUtc)) throw new HttpError(409, "A reminder was already sent to this member today.");
  const message = membership.expiry_date ? `Your SetSaathi membership expires on ${membership.expiry_date}. Please contact your gym to renew.` : "Please contact your gym about your SetSaathi membership.";
  await env.DB.prepare("INSERT INTO reminders (user_id, membership_id, channel, trigger_type, message, created_at, sent_at) VALUES (?, ?, 'in_app', 'manual', ?, ?, ?)")
    .bind(member.id, membership.id, message, nowIso(), nowIso()).run();
  return json({ channel: "in_app", message }, 201);
});

route("GET", "/api/reminders", async ({ req, env }) => {
  const member = await requireMember(req, env);
  return json({ reminders: await all(env, "SELECT id, message, created_at, seen_at FROM reminders WHERE user_id = ? ORDER BY id DESC LIMIT 20", member.id) });
});
route("PUT", "/api/reminders/{id}/seen", async ({ req, env, params }) => {
  const member = await requireMember(req, env);
  const id = Number(params[0]);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, "Reminder not found.");
  const result = await env.DB.prepare("UPDATE reminders SET seen_at = COALESCE(seen_at, ?) WHERE id = ? AND user_id = ?").bind(nowIso(), id, member.id).run();
  if (!result.meta.changes) throw new HttpError(404, "Reminder not found.");
  return json({ seen: true });
});

// Gym management data is scoped to the authenticated admin. A roster entry is not a
// SetSaathi member account; gym owners cannot browse another user's private data.
route("GET", "/api/admin/workspace", async ({ req, env }) => {
  const admin = await requireAdmin(req, env);
  const gym = await first<{ name: string; address: string; phone: string }>(env,
    "SELECT name, address, phone FROM admin_gyms WHERE admin_user_id = ?", admin.id);
  const members = await all(env,
    "SELECT id, full_name, mobile, email, plan_name, started_at, expires_at, notes, archived, created_at, updated_at FROM admin_members WHERE admin_user_id = ? ORDER BY archived, expires_at, full_name", admin.id);
  return json({ gym: gym ?? null, members });
});
route("PUT", "/api/admin/gym", async ({ req, env }) => {
  const admin = await requireAdmin(req, env);
  const p = S.parse(S.AdminGymRequest, await readBody(req));
  await env.DB.prepare("INSERT INTO admin_gyms (admin_user_id, name, address, phone, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(admin_user_id) DO UPDATE SET name = excluded.name, address = excluded.address, phone = excluded.phone, updated_at = excluded.updated_at")
    .bind(admin.id, p.name, p.address, p.phone, nowIso()).run();
  return json({ name: p.name, address: p.address, phone: p.phone });
});
route("POST", "/api/admin/members", async ({ req, env }) => {
  const admin = await requireAdmin(req, env);
  if (!await first(env, "SELECT admin_user_id FROM admin_gyms WHERE admin_user_id = ?", admin.id)) throw new HttpError(409, "Add your gym details before adding members.");
  const p = S.parse(S.AdminMemberRequest, await readBody(req));
  if (p.expires_at <= p.started_at) throw new HttpError(422, "Expiry date must be after the start date.");
  const now = nowIso();
  const result = await env.DB.prepare("INSERT INTO admin_members (admin_user_id, full_name, mobile, email, plan_name, started_at, expires_at, notes, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(admin.id, p.full_name, p.mobile, p.email.toLowerCase(), p.plan_name, p.started_at, p.expires_at, p.notes, p.archived ? 1 : 0, now, now).run();
  return json({ id: result.meta.last_row_id }, 201);
});
route("PUT", "/api/admin/members/{id}", async ({ req, env, params }) => {
  const admin = await requireAdmin(req, env);
  const id = Number(params[0]);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(422, "Invalid member ID.");
  if (!await first(env, "SELECT id FROM admin_members WHERE id = ? AND admin_user_id = ?", id, admin.id)) throw new HttpError(404, "Member record not found.");
  const p = S.parse(S.AdminMemberRequest, await readBody(req));
  if (p.expires_at <= p.started_at) throw new HttpError(422, "Expiry date must be after the start date.");
  await env.DB.prepare("UPDATE admin_members SET full_name = ?, mobile = ?, email = ?, plan_name = ?, started_at = ?, expires_at = ?, notes = ?, archived = ?, updated_at = ? WHERE id = ? AND admin_user_id = ?")
    .bind(p.full_name, p.mobile, p.email.toLowerCase(), p.plan_name, p.started_at, p.expires_at, p.notes, p.archived ? 1 : 0, nowIso(), id, admin.id).run();
  return json({ id });
});

// ---------- entry ----------
export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/") && url.pathname !== "/health") {
    return env.ASSETS ? env.ASSETS.fetch(req) : json({ detail: "Not Found" }, 404);
  }
  try {
    if (!env.DB) throw new HttpError(503, "The database is not connected. Add the D1 binding named DB to this Worker.");
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;
    let pathMatched = false;
    for (const [method, re, handler] of routes) {
      const m = re.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (method !== req.method) continue;
      await ensureAdmin(env);
      return await handler({ req, env, url, params: m.slice(1).map(decodeURIComponent) });
    }
    return json({ detail: pathMatched ? "Method Not Allowed" : "Not Found" }, pathMatched ? 405 : 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ detail: e.detail, ...(e.errors ? { errors: e.errors } : {}) }, e.status);
    if (/no such (table|column)/i.test(String(e))) {
      console.error("Database schema is incomplete", (e as Error)?.message);
      if (url.pathname === "/api/workout-sets") return json({ detail: "Set logging is not ready yet. Apply the workout sets D1 migration, then try again." }, 503);
      return json({ detail: "The database setup is incomplete. Apply the pending D1 migrations before signing in." }, 503);
    }
    console.error("Unhandled error", (e as Error)?.message); // never log request bodies or credentials
    return json({ detail: "Internal server error." }, 500);
  }
}

export default { fetch: handle } satisfies ExportedHandler<Env>;
