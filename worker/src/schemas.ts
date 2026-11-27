import { z } from "zod";
import { HttpError, isRealDate, todayIso } from "./util";

const MOBILE = /^\+[1-9]\d{7,14}$/;
const MOBILE_MSG = "Enter a valid mobile with country code, e.g. +919876543210";

export function normalizeMobile(value: string): string {
  const compact = value.replace(/[\s()-]/g, "");
  return compact.startsWith("00") ? "+" + compact.slice(2) : compact;
}

const name = z.string().min(2, "String should have at least 2 characters").max(120, "String should have at most 120 characters").transform((v) => v.split(/\s+/).filter(Boolean).join(" "));
const username = z.string().min(3, "String should have at least 3 characters").max(80, "String should have at most 80 characters").regex(/^[a-zA-Z0-9_.-]+$/, "String should match pattern '^[a-zA-Z0-9_.-]+$'").transform((v) => v.trim().toLowerCase());
const email = z.string().max(320).email("value is not a valid email address").transform((v) => v.trim().toLowerCase());
const mobile = z.string().transform(normalizeMobile).refine((v) => MOBILE.test(v), MOBILE_MSG);
const date = z.string().refine(isRealDate, "Input should be a valid date in the format YYYY-MM-DD");

export const RegisterRequest = z.object({
  name, username, email, mobile,
  password: z.string().min(8, "String should have at least 8 characters").max(128, "String should have at most 128 characters"),
});

export const ChangePasswordRequest = z.object({
  current_password: z.string().min(1).max(128),
  new_password: z.string().min(8, "String should have at least 8 characters").max(128, "String should have at most 128 characters"),
});

export const ForgotPasswordRequest = z.object({
  email: z.string().trim().toLowerCase().max(200),
});

export const ResetPasswordRequest = z.object({
  email: z.string().trim().toLowerCase().max(200),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
  new_password: z.string().min(8, "String should have at least 8 characters").max(128, "String should have at most 128 characters"),
});

export const LoginRequest = z.object({
  identifier: z.string().min(3).max(320).transform((v) => {
    const c = v.trim();
    return c.startsWith("+") || c.startsWith("00") ? normalizeMobile(c) : c.toLowerCase();
  }),
  password: z.string().min(1).max(128),
  expected_role: z.enum(["member", "staff", "admin", "staff_admin"]),
});

export const AdminUserStatusRequest = z.object({ status: z.enum(["active", "blocked"]), reason: z.string().trim().max(500).optional() });

export const ProfileUpdateRequest = z.object({ name, username, mobile, email });

export const MembershipSubscriptionRequest = z.object({
  event_type: z.enum(["new", "renewed", "updated"]),
  gym_name: z.string().min(2).max(120).transform((v) => v.split(/\s+/).filter(Boolean).join(" ")),
  membership_plan: z.string().min(2).max(60).transform((v) => v.split(/\s+/).filter(Boolean).join(" ")),
  started_at: date,
  expires_at: date,
});

export const AdminGymRequest = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  phone: z.string().trim().max(30).default(""),
});

export const AdminMemberRequest = z.object({
  full_name: z.string().trim().min(2).max(120),
  mobile: z.string().trim().max(30).default(""),
  email: z.union([z.email().max(320), z.literal("")]).default(""),
  plan_name: z.string().trim().min(2).max(80),
  started_at: date,
  expires_at: date,
  notes: z.string().trim().max(500).default(""),
  archived: z.boolean().default(false),
});

export const PlanRequest = z.object({
  goal: z.enum(["Build muscle", "Get stronger", "Lose fat", "Stay active"]),
  experience: z.enum(["Beginner", "Intermediate", "Expert"]),
  days_per_week: z.number().int().min(2).max(6),
  location: z.enum(["Gym", "Home"]),
  equipment: z.enum(["Full gym", "Dumbbells", "Bodyweight"]),
  split: z.enum(["Full body", "Upper/lower", "Push pull legs", "Muscle split"]),
  session_length: z.number().int().min(30).max(90),
  spine_safety: z.enum(["Standard", "Extra caution", "Avoid spinal loading"]).default("Standard"),
});
export type PlanRequestT = z.infer<typeof PlanRequest>;
export const PlanTypeRequest = z.object({ split: PlanRequest.shape.split });

export const EquipmentSelection = z.object({ equipment: z.array(z.string()).max(30) });
export const GymEquipmentUpdate = z.object({
  equipment: z.array(z.string()).max(60),
  location: z.string().min(2).max(300).transform((v) => v.split(/\s+/).filter(Boolean).join(" ")).refine((v) => v.length >= 2, "Enter a branch or locality."),
  place_token: z.string().nullish(),
});

export const WorkoutEventRequest = z.object({
  workout_day: z.string().min(3).max(20),
  exercise_name: z.string().min(2).max(120),
  event_type: z.enum(["skipped", "changed"]),
  replacement_name: z.string().max(120).nullish(),
});

export const WorkoutProgressRequest = z.object({
  workout_date: date,
  workout_day: z.string().min(3).max(20),
  exercise_name: z.string().min(2).max(120),
  status: z.enum(["pending", "completed", "skipped", "replaced"]),
  replacement_name: z.string().max(120).nullish(),
  notes: z.string().max(500).default(""),
});

export const WorkoutSetsRequest = z.object({
  workout_date: date,
  exercise_name: z.string().min(2).max(120),
  sets: z.array(z.object({
    set_number: z.number().int().min(1).max(20),
    reps: z.number().int().min(0).max(1000),
    weight_kg: z.number().min(0).max(2000).nullable(),
  })).max(20).refine(items => new Set(items.map(item => item.set_number)).size === items.length, "Set numbers must be unique."),
});

export const BodyMeasurementRequest = z.object({
  recorded_at: date.default(() => todayIso()),
  height_cm: z.number().min(100).max(250),
  weight_kg: z.number().min(25).max(350),
});

export const GymAttendanceRequest = z.object({ workout_date: date, status: z.enum(["completed", "skipped", "rest"]) });

export const CoachQuestionRequest = z.object({ question: z.string().min(3).max(800), context: z.string().max(5000).default("") });

/** Parse with zod; failures become a 422 whose `detail` is a readable string (the UI renders `detail` directly). */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const errors = result.error.issues.map((i) => ({ loc: ["body", ...i.path], msg: i.message, type: i.code }));
  const first = result.error.issues[0];
  const field = first.path.length ? `${first.path.join(".")}: ` : "";
  throw new HttpError(422, `${field}${first.message}`, errors);
}

export function parseDate(value: string | null, label: string): string {
  if (value === null || !isRealDate(value)) throw new HttpError(422, `${label}: Input should be a valid date in the format YYYY-MM-DD`);
  return value;
}
