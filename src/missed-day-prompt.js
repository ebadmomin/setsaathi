import {API_BASE} from "./api-config.js";

// Missed-workout prompt. When a scheduled training day in the past week was not completed and
// today is also a training day, ask the member how to continue:
//   A) Shift the sequence: do the missed day's workout today, then carry on with the split.
//   B) Stick to the calendar: do today's scheduled workout and skip the missed one.
const PLAN_KEY = "setsaathi_current_plan";
const CHOICE_PREFIX = "setsaathi_missed_choice_";
const escapeText = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char]);
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const weekdayName = date => new Intl.DateTimeFormat("en-US", {weekday: "long"}).format(date);
const readPlan = () => { try { return JSON.parse(localStorage.getItem(PLAN_KEY) || "null"); } catch { return null; } };
const readChoice = key => { try { return localStorage.getItem(key); } catch { return null; } };
const writeChoice = (key, value) => { try { localStorage.setItem(key, value); } catch { /* storage unavailable: prompt may repeat */ } };

async function fetchAttendance(start, end) {
  const response = await fetch(`${API_BASE}/api/gym-attendance?start=${dateKey(start)}&end=${dateKey(end)}`, {
    headers: {Authorization: `Bearer ${localStorage.getItem("setsaathi_token")}`},
  });
  if (!response.ok) return new Map();
  const records = await response.json();
  return new Map(records.map(record => [record.workout_date, record.status]));
}

// Returns the most recent missed training day in the past seven days, or null.
function findMissedDay(plan, attendance, today) {
  const days = plan?.days || [];
  for (let offset = 1; offset <= 7; offset++) {
    const date = addDays(today, -offset);
    const name = weekdayName(date);
    const scheduled = days.find(day => day.day === name);
    if (!scheduled) continue;
    const status = attendance.get(dateKey(date));
    if (status !== "completed" && status !== "rest") return {date: dateKey(date), name, focus: scheduled.focus};
  }
  return null;
}

async function chooseOption(banner, sourceDay, todayKey) {
  const buttons = banner.querySelectorAll("button");
  const message = banner.querySelector(".missed-day-message");
  buttons.forEach(button => { button.disabled = true; });
  message.textContent = "Updating today's workout…";
  try {
    const response = await fetch(`${API_BASE}/api/plans/today/from-current`, {
      method: "POST",
      headers: {Authorization: `Bearer ${localStorage.getItem("setsaathi_token")}`, "Content-Type": "application/json"},
      body: JSON.stringify(sourceDay ? {source_day: sourceDay} : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Could not update today's workout.");
    writeChoice(CHOICE_PREFIX + todayKey, sourceDay ? "shift" : "calendar");
    localStorage.setItem("setsaathi_active_view", "plan");
    location.reload();
  } catch (error) {
    message.textContent = error.message;
    buttons.forEach(button => { button.disabled = false; });
  }
}

async function renderPrompt(view) {
  if (view.querySelector(".missed-day-prompt")) return;
  const plan = readPlan();
  const today = new Date();
  const todayKey = dateKey(today);
  const todayName = weekdayName(today);
  if (!plan?.days?.length || readChoice(CHOICE_PREFIX + todayKey)) return;
  const todayPlan = plan.days.find(day => day.day === todayName);
  if (!todayPlan) return;
  const attendance = await fetchAttendance(addDays(today, -7), addDays(today, -1));
  if (attendance.get(todayKey) === "completed") return;
  const missed = findMissedDay(plan, attendance, today);
  if (!missed || view.querySelector(".missed-day-prompt")) return;

  const banner = document.createElement("section");
  banner.className = "missed-day-prompt";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Missed workout");
  banner.innerHTML = `
    <p class="eyebrow">MISSED WORKOUT</p>
    <h3>You missed ${escapeText(missed.name)} · ${escapeText(missed.focus)}.</h3>
    <p class="missed-day-copy">How would you like to continue today?</p>
    <div class="missed-day-options">
      <button type="button" class="missed-day-option" data-option="shift">
        <strong>Shift the sequence</strong>
        <span>Do ${escapeText(missed.focus)} today, then continue the split from there.</span>
      </button>
      <button type="button" class="missed-day-option" data-option="calendar">
        <strong>Stick to the calendar</strong>
        <span>Skip the missed workout and do today's ${escapeText(todayPlan.focus)} session.</span>
      </button>
    </div>
    <p class="missed-day-message" role="status" aria-live="polite"></p>`;
  banner.querySelector('[data-option="shift"]').addEventListener("click", () => chooseOption(banner, missed.name, todayKey));
  banner.querySelector('[data-option="calendar"]').addEventListener("click", () => chooseOption(banner, null, todayKey));
  view.prepend(banner);
}

let checking = false;
new MutationObserver(() => {
  const view = document.querySelector(".workout-plan-view");
  if (!view || view.hidden || view.querySelector(".missed-day-prompt") || checking) return;
  checking = true;
  renderPrompt(view).catch(() => { /* the prompt is optional; the plan view still works */ }).finally(() => { checking = false; });
}).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"]});
