// Deterministic plan generator: faithful port of build_generated_plan in backend/app/main.py.
import { requirementsFor } from "./equipment";
import { HttpError, WEEKDAY_NAMES } from "./util";
import type { PlanRequestT } from "./schemas";
import { sha256Hex } from "./security";

export interface LibraryItem { name: string; primary_muscle: string; category: string; equipment: string; difficulty: string; substitute: string }
export interface PlanExercise { name: string; phase: "Warm-up" | "Main" | "Finisher"; sets: number; reps: string; rest_seconds: number; substitute: string; risk_note: string | null }
export interface PlanDay { day: string; focus: string; exercises: PlanExercise[] }
export interface GeneratedPlan { title: string; rationale: string; days: PlanDay[] }
export interface TemplateRow { id: number; version: number; structure_json: string; pools_json: string }
export interface VariantRow { id: number; number: number; pools_json: string }

const FOCUS_MUSCLES: Record<string, string[]> = {
  Push: ["Chest", "Shoulders", "Triceps"],
  Pull: ["Lats", "Middle Back", "Lower Back", "Biceps", "Traps", "Forearms", "Back"],
  Legs: ["Quadriceps", "Quads", "Hamstrings", "Glutes", "Calves", "Adductors", "Abductors"],
  Upper: ["Chest", "Shoulders", "Triceps", "Lats", "Middle Back", "Biceps", "Traps", "Forearms", "Back"],
  Lower: ["Quadriceps", "Quads", "Hamstrings", "Glutes", "Calves", "Adductors", "Abductors"],
  "Full body": ["Quadriceps", "Chest", "Lats", "Hamstrings", "Shoulders", "Middle Back", "Glutes", "Abdominals", "Triceps", "Biceps", "Calves", "Full Body"],
  Chest: ["Chest"],
  Back: ["Lats", "Middle Back", "Lower Back", "Back", "Traps"],
  Shoulders: ["Shoulders", "Traps"],
  Arms: ["Biceps", "Triceps", "Forearms"],
};
const AVOID_SPINAL: Record<string, string> = { "Barbell Back Squat": "Leg Press", "Dumbbell Romanian Deadlift": "Glute Bridge", "Goblet Squat": "Bodyweight Squat" };
const SPINE_SENSITIVE = new Set(["Barbell Back Squat", "Dumbbell Romanian Deadlift", "Goblet Squat", "Leg Press"]);
const LEVELS: Record<string, string[]> = { Beginner: ["beginner"], Intermediate: ["beginner", "intermediate"], Expert: ["beginner", "intermediate", "expert"] };

type Pair = [string, string];

export function buildGeneratedPlan(payload: PlanRequestT, library: LibraryItem[], template: TemplateRow | null, availableEquipment: Set<string> | null, variant: VariantRow | null): GeneratedPlan {
  if (payload.split === "Push pull legs" && payload.days_per_week < 3) throw new HttpError(422, "Push pull legs needs at least 3 training days each week.");
  if (payload.split === "Upper/lower" && payload.days_per_week < 4) throw new HttpError(422, "Upper/lower works best with at least 4 training days each week.");
  if (payload.split === "Muscle split" && payload.days_per_week < 5) throw new HttpError(422, "Muscle split needs at least 5 training days each week.");
  const reps = payload.goal === "Build muscle" ? "8–12" : payload.goal === "Get stronger" ? "4–6" : "10–15";
  const rest = payload.goal === "Get stronger" ? 90 : 60;
  if (!template) throw new HttpError(503, "Workout templates are unavailable.");
  const structure = JSON.parse(template.structure_json) as { warmup: number; main: number; finisher: number; main_sets: number };
  const pools = JSON.parse(variant ? variant.pools_json : template.pools_json) as Record<string, Record<string, string[]>>;
  const variantRotation = variant ? (variant.number - 1) * 7 : 0;
  const byName = new Map(library.map((i) => [i.name.toLowerCase(), i]));
  const main: Record<string, Pair[]> = {}, warm: Record<string, Pair[]> = {}, fin: Record<string, Pair[]> = {};
  for (const [focus, phases] of Object.entries(pools)) {
    for (const [phase, names] of Object.entries(phases)) {
      const preferred: Pair[] = names.map((n) => [n, byName.get(n.toLowerCase())?.substitute ?? "Choose a related exercise"]);
      if (phase === "Warm-up") warm[focus] = preferred; else if (phase === "Main") main[focus] = preferred; else fin[focus] = preferred;
    }
  }
  const focuses = payload.split === "Push pull legs" ? ["Push", "Pull", "Legs"] : payload.split === "Upper/lower" ? ["Upper", "Lower"] : payload.split === "Muscle split" ? ["Chest", "Back", "Legs", "Shoulders", "Arms"] : ["Full body"];
  const used = new Set<string>();
  const availLower = availableEquipment;

  const equipmentAllowed = (item: LibraryItem): boolean => {
    // Gym inventories are informational and may be incomplete.
    if (payload.location === "Gym") return true;
    if (availLower !== null) {
      const req = requirementsFor(item);
      return req !== null && req.every((r) => availLower.has(r.toLowerCase()));
    }
    if (payload.equipment === "Full gym") return true;
    const e = item.equipment.toLowerCase();
    if (payload.equipment === "Dumbbells") return ["dumbbell", "bodyweight", "body only", "bands", "none", "bench"].includes(e);
    return ["bodyweight", "body only", "none"].includes(e);
  };
  const levelAllowed = (item: LibraryItem) => LEVELS[payload.experience].includes(item.difficulty.toLowerCase());
  const lc = (a: string, b: string) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);

  const cache = new Map<string, Pair[]>();
  const libraryCandidates = (focus: string, phase: string): Pair[] => {
    const ck = `${focus}|${phase}`;
    const hit = cache.get(ck);
    if (hit) return hit;
    const categories = phase === "Warm-up" ? ["stretching", "cardio"] : phase === "Finisher" ? ["cardio", "plyometrics", "strongman"] : ["strength", "powerlifting", "olympic weightlifting", "strongman"];
    let eligible = library.filter((i) => categories.includes(i.category.toLowerCase()) && equipmentAllowed(i) && levelAllowed(i));
    const order = FOCUS_MUSCLES[focus];
    if (focus !== "Full body" && phase === "Main") eligible = eligible.filter((i) => order.includes(i.primary_muscle));
    const groups = new Map<string, LibraryItem[]>();
    for (const i of eligible) { if (!groups.has(i.primary_muscle)) groups.set(i.primary_muscle, []); groups.get(i.primary_muscle)!.push(i); }
    for (const items of groups.values()) items.sort((a, b) => lc(a.name, b.name));
    const extra = [...groups.keys()].filter((m) => !order.includes(m)).sort();
    const ordered = [...order.filter((m) => groups.has(m)), ...extra];
    const diverse: LibraryItem[] = [];
    while (ordered.some((m) => groups.get(m)?.length)) {
      for (const m of ordered) { const g = groups.get(m); if (g?.length) diverse.push(g.shift()!); }
    }
    const primary: Pair[] = diverse.map((i) => [i.name, i.substitute || "Choose another exercise for the same muscle group"]);
    const alternatives: Pair[] = diverse.filter((i) => i.substitute && !i.substitute.toLowerCase().startsWith("see related")).map((i) => [i.substitute, i.name]);
    let candidates = [...primary, ...alternatives];
    if (candidates.length && variantRotation) {
      const off = variantRotation % candidates.length;
      candidates = [...candidates.slice(off), ...candidates.slice(0, off)];
    }
    cache.set(ck, candidates);
    return candidates;
  };

  const relaxedFinisherCandidates = (): Pair[] =>
    library
      .filter((i) => ["cardio", "plyometrics", "strongman"].includes(i.category.toLowerCase()) && levelAllowed(i))
      .sort((a, b) => lc(a.name, b.name))
      .map((i): Pair => [i.name, i.substitute || "Choose another cardio exercise"]);

  const takeUnique = (preferred: Pair[], focus: string, phase: string, count: number, transform: (n: string) => string = (n) => n): [string, string, string][] => {
    const selected: [string, string, string][] = [];
    const alts: Pair[] = preferred.filter(([, s]) => s && !s.toLowerCase().startsWith("see related")).map(([n, s]) => [s, n]);
    // Lazily append library candidates (same order as the reference, which concatenated eagerly).
    // Finisher fallback: when equipment filters leave too few cardio/plyometric/strongman options,
    // broaden only finishers to any such movement the member's level allows (main lifts stay strict).
    const relaxedSource = () => (phase === "Finisher" ? relaxedFinisherCandidates() : []);
    const sources: (() => Pair[])[] = [() => preferred, () => alts, () => libraryCandidates(focus, phase), relaxedSource];
    for (const src of sources) {
      const relaxed = src === relaxedSource;
      for (const [original, substitute] of src()) {
        const finalName = transform(original);
        const key = finalName.toLowerCase();
        const item = byName.get(key);
        if (!item || used.has(key)) continue;
        if (relaxed ? !levelAllowed(item) : !equipmentAllowed(item)) continue;
        used.add(key);
        selected.push([finalName, substitute, original]);
        if (selected.length === count) return selected;
      }
    }
    throw new HttpError(422, `Not enough unique ${phase.toLowerCase()} exercises are available for this plan. Try another plan type or training level.`);
  };

  const days: PlanDay[] = [];
  for (let index = 0; index < payload.days_per_week; index++) {
    const focus = focuses[index % focuses.length];
    const warmups: PlanExercise[] = takeUnique(warm[focus], focus, "Warm-up", structure.warmup).map(([name, substitute]) => ({ name, phase: "Warm-up", sets: payload.experience === "Beginner" ? 1 : 2, reps: "8–12 controlled reps", rest_seconds: 20, substitute, risk_note: null }));
    const transform = payload.spine_safety === "Avoid spinal loading" ? (n: string) => AVOID_SPINAL[n] ?? n : (n: string) => n;
    const mains: PlanExercise[] = takeUnique(main[focus], focus, "Main", structure.main, transform).map(([name, substitute, original]) => {
      let risk: string | null = null;
      if (SPINE_SENSITIVE.has(name) || SPINE_SENSITIVE.has(original)) {
        risk = "Spine safety: brace your core and keep a neutral back. Change or skip this movement if it causes back pain.";
        if (payload.spine_safety === "Extra caution") risk += " Use a conservative load and a pain-free range; seek qualified guidance if you have an existing spine concern.";
        else if (payload.spine_safety === "Avoid spinal loading") risk = "Spine-conscious replacement selected. Keep the movement controlled and stop if symptoms appear.";
      }
      return { name, phase: "Main", sets: structure.main_sets, reps: name !== "Plank" ? reps : "30–45 sec", rest_seconds: rest, substitute, risk_note: risk };
    });
    const finishers: PlanExercise[] = takeUnique(fin[focus], focus, "Finisher", structure.finisher).map(([name, substitute]) => ({ name, phase: "Finisher", sets: payload.experience === "Beginner" ? 1 : 2, reps: "30–45 sec", rest_seconds: 30, substitute, risk_note: null }));
    days.push({ day: WEEKDAY_NAMES[index], focus, exercises: [...warmups, ...mains, ...finishers] });
  }
  const variation = variant ? ` · variation ${variant.number}` : "";
  return {
    title: `${payload.days_per_week}-day ${payload.split} plan`,
    rationale: `Template v${template.version}${variation}: a ${payload.experience.toLowerCase()} ${payload.goal.toLowerCase()} plan with ${structure.warmup} warm-ups, ${structure.main} main exercises, and ${structure.finisher} finishers per session. Spine setting: ${payload.spine_safety}.`,
    days,
  };
}

/** Compare the actual movements, not a variant id or cosmetic reorder. */
export async function planExerciseSignature(days: PlanDay[]): Promise<string> {
  const names = days.flatMap((d) => d.exercises.map((e) => e.name.toLowerCase())).sort();
  return sha256Hex(JSON.stringify(names));
}
