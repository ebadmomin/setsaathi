import {SKIP_ICON_SVG} from "./ui-utils.js";
import {API_BASE} from "./api-config.js";
const attendanceApi = `${API_BASE}/api/gym-attendance`;
const shortDays = ["M", "T", "W", "T", "F", "S", "S"];
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const attendanceLabels = { completed: "Gym done", skipped: "Gym skipped", rest: "Rest day", none: "Not logged" };
const attendanceSymbols = { completed: "✓", skipped: SKIP_ICON_SVG, rest: "R", none: "—" };
let selectedMonthOffset = 0;
const displayedMonth = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset, 1); };

async function saveAttendance(status) {
  const response = await fetch(attendanceApi, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("setsaathi_token")}` },
    body: JSON.stringify({ workout_date: dateKey(new Date()), status }),
  });
  if (response.ok) await loadAttendance();
}

async function loadAttendance() {
  const summary = document.querySelector(".dashboard-summary");
  if (!summary) return;
  const now = new Date(), monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const shownMonth = displayedMonth(), monthStart = shownMonth;
  const monthEnd = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 0);
  const start = new Date(Math.min(monday, monthStart));
  const end = new Date(Math.max(sunday, monthEnd));
  const response = await fetch(`${attendanceApi}?start=${dateKey(start)}&end=${dateKey(end)}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("setsaathi_token")}` },
  });
  if (!response.ok) return;

  const records = await response.json();
  if (dateKey(displayedMonth()).slice(0, 7) !== dateKey(monthStart).slice(0, 7)) return;
  const byDate = Object.fromEntries(records.map(item => [item.workout_date, item.status]));
  summary.querySelectorAll("[data-date]").forEach(box => {
    const status = byDate[box.dataset.date] || "none";
    box.classList.remove("completed", "skipped", "rest");
    if (status !== "none") box.classList.add(status);
    box.querySelector(".status-symbol").innerHTML = attendanceSymbols[status];
    const label = box.querySelector(".day-status-label");
    if (label) label.textContent = attendanceLabels[status];
  });

  const todayStatus = byDate[dateKey(now)] || "none";
  const todayPill = summary.querySelector(".today-attendance");
  todayPill.dataset.attendance = todayStatus;
  todayPill.textContent = attendanceLabels[todayStatus];
  summary.querySelectorAll(".today-checkin [data-status]").forEach(button => {
    button.classList.toggle("selected", button.dataset.status === todayStatus);
    button.setAttribute("aria-pressed", String(button.dataset.status === todayStatus));
  });

  const monthRecords = records.filter(item => item.workout_date.startsWith(dateKey(monthStart).slice(0, 7)));
  const completed = monthRecords.filter(item => item.status === "completed").length;
  const skipped = monthRecords.filter(item => item.status === "skipped").length;
  const marked = completed + skipped;
  const percent = marked ? Math.round(completed / marked * 100) : null;
  summary.querySelector(".monthly-percent").textContent = percent == null ? "—" : `${percent}%`;
  summary.querySelector(".monthly-done-count").textContent = completed;
  summary.querySelector(".monthly-skipped-count").textContent = skipped;
}

function buildTrackers(summary) {
  const now = new Date(), shownMonth = displayedMonth(), monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const week = shortDays.map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return `<b data-date="${dateKey(date)}" class="${dateKey(date) === dateKey(now) ? "today" : ""}"><span>${day}</span><small>${date.getDate()} ${date.toLocaleString(undefined, {month: "short"})}</small><i class="status-symbol">—</i><em class="day-status-label">Not logged</em></b>`;
  }).join("");
  const daysInMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 0).getDate();
  const month = Array.from({length: daysInMonth}, (_, index) => {
    const date = new Date(shownMonth.getFullYear(), shownMonth.getMonth(), index + 1);
    return `<b data-date="${dateKey(date)}" class="${dateKey(date) === dateKey(now) ? "today" : ""}"><small>${index + 1}</small><i class="status-symbol">—</i></b>`;
  }).join("");
  const weekRange = `${monday.toLocaleDateString(undefined, {day: "numeric", month: "short"})} – ${sunday.toLocaleDateString(undefined, {day: "numeric", month: "short"})}`;

  summary.innerHTML = `
    <article class="dashboard-workout-panel">
      <div class="panel-heading"><p>WORKOUT LOG</p><h3>Today's check-in</h3></div>
      <div class="panel-body"><span>Record your gym visit, then open your workout to mark exercises.</span><strong class="today-attendance" data-attendance="none">Not logged</strong><div class="today-checkin" role="group" aria-label="Today's gym attendance"><button type="button" data-status="completed" aria-pressed="false">✓ Gym done</button><button type="button" data-status="skipped" aria-pressed="false">${SKIP_ICON_SVG} Gym skipped</button><button type="button" data-status="rest" aria-pressed="false">Rest day</button></div></div>
      <button type="button" class="panel-action" data-open="log">Open workout log <span aria-hidden="true">→</span></button>
    </article>
    <article class="weekly-panel">
      <div class="panel-heading"><p>WEEKLY TRACKER</p><h3>This week</h3><span class="week-range">${weekRange}</span></div>
      <div class="panel-body"><div class="week-boxes">${week}</div></div>
    </article>
    <article class="monthly-panel">
      <div class="panel-heading"><p>MONTHLY TRACKER</p><div class="monthly-title"><h3>${shownMonth.toLocaleString(undefined, {month: "long", year: "numeric"})}</h3><div class="monthly-navigation"><button type="button" data-month-step="-1" aria-label="Previous month">‹</button><button type="button" data-month-step="1" aria-label="Next month" ${selectedMonthOffset >= 0 ? "disabled" : ""}>›</button></div></div><div class="monthly-summary"><strong class="monthly-percent">—</strong><span>of marked gym days completed</span></div><div class="monthly-counts"><span><b class="monthly-done-count">0</b> done</span><span><b class="monthly-skipped-count">0</b> skipped</span></div><p class="monthly-hint">Select a date to review its workout.</p></div>
      <div class="panel-body"><div class="month-boxes">${month}</div><div class="status-key"><b class="done">✓ Gym done</b><b class="skipped">${SKIP_ICON_SVG} Gym skipped</b><b class="rest-key">R Rest day</b></div></div>
    </article>`;
  summary.querySelector("[data-open='log']").onclick = () => document.querySelector(".app-tabs [data-view='log']")?.click();
  summary.querySelectorAll("[data-month-step]").forEach(button => button.onclick = () => { selectedMonthOffset = Math.min(0, selectedMonthOffset + Number(button.dataset.monthStep)); buildTrackers(summary); });
  summary.querySelectorAll(".today-checkin button[data-status]").forEach(button => button.onclick = () => saveAttendance(button.dataset.status));
  loadAttendance();
}

new MutationObserver(() => {
  const summary = document.querySelector(".dashboard-summary");
  if (!summary || summary.dataset.enhanced) return;
  summary.dataset.enhanced = "true";
  buildTrackers(summary);
}).observe(document.documentElement, {childList: true, subtree: true});

document.addEventListener("click", event => {
  const box = event.target.closest(".week-boxes [data-date],.month-boxes [data-date]");
  if (!box) return;
  localStorage.setItem("setsaathi_log_date", box.dataset.date);
  document.querySelector(".app-tabs [data-view='log']")?.click();
});
window.addEventListener("attendance-updated", () => loadAttendance());
