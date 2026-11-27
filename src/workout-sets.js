import {API_BASE} from "./api-config.js";

const endpoint = `${API_BASE}/api/workout-sets`;
export let workoutSets = [];
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const token = () => localStorage.getItem("setsaathi_token");
const today = () => new Date().toLocaleDateString("en-CA");
let setReturnFocus = null;

export async function loadWorkoutSets(start, end) {
  const response = await fetch(`${endpoint}?start=${start}&end=${end}`, {headers: {Authorization: `Bearer ${token()}`}});
  if (!response.ok) throw new Error("Could not load your set log.");
  workoutSets = await response.json();
  return workoutSets;
}

export function setsFor(date, exercise) {
  return workoutSets.filter(item => item.workout_date === date && item.exercise_name === exercise).sort((a, b) => a.set_number - b.set_number);
}

export function renderSetEditor(date, exercise, plannedSets) {
  const rows = setsFor(date, exercise);
  return `<div class="set-log" data-set-date="${escape(date)}" data-set-exercise="${escape(exercise)}" data-planned-sets="${escape(plannedSets)}"><button type="button" class="set-log-trigger" data-set-action="open" aria-label="${rows.length ? "View or edit" : "Log"} sets for ${escape(exercise)}">${rows.length ? "View / Edit Sets" : "Log Sets"}</button></div>`;
}

function closeSetDialog() {
  document.querySelector(".set-log-overlay")?.remove();
  document.body.classList.remove("set-log-open");
  if (setReturnFocus?.isConnected) setReturnFocus.focus();
  setReturnFocus = null;
}

function openSetDialog(button) {
  closeSetDialog();
  setReturnFocus = button;
  const source = button.closest(".set-log");
  const {setDate, setExercise} = source.dataset;
  const saved = setsFor(setDate, setExercise);
  const initial = saved.length ? saved : [{set_number: 1, reps: "", weight_kg: ""}];
  const overlay = document.createElement("div");
  overlay.className = "set-log-overlay";
  overlay.innerHTML = `<section class="set-log-dialog" role="dialog" aria-modal="true" aria-labelledby="set-log-title" data-set-date="${escape(setDate)}" data-set-exercise="${escape(setExercise)}"><div class="set-log-dialog-head"><div><span class="set-log-kicker">WORKOUT RECORD</span><h2 id="set-log-title">${saved.length ? "View / Edit Sets" : "Log Sets"}</h2><p>${escape(setExercise)}</p><small>Optional — track only when you want to.</small></div><button type="button" class="set-log-close modal-close-button" data-set-action="close" aria-label="Close set log">×</button></div><form class="set-log-form"><div class="set-log-head"><span>Set</span><span>Reps</span><span>Weight (kg)</span></div><div class="set-log-rows">${initial.map(setRow).join("")}</div><div class="set-log-actions"><button type="button" data-set-action="add">+ Add set</button><button type="submit">Save sets</button></div><p class="set-log-notice" role="status" aria-live="polite"></p></form></section>`;
  document.body.append(overlay);
  document.body.classList.add("set-log-open");
  overlay.querySelector('[name="reps"]')?.focus();
}

function setRow(row) {
  return `<div class="set-log-row"><span>${row.set_number}</span><label><span class="sr-only">Set ${row.set_number} reps</span><input name="reps" type="number" min="0" max="1000" step="1" inputmode="numeric" value="${escape(row.reps)}" placeholder="Reps"></label><label><span class="sr-only">Set ${row.set_number} weight in kilograms</span><input name="weight" type="number" min="0" max="2000" step="0.25" inputmode="decimal" value="${escape(row.weight_kg ?? "")}" placeholder="Bodyweight"></label><button type="button" data-set-action="remove" aria-label="Remove set ${row.set_number}" title="Remove set">×</button></div>`;
}

export function handleSetClick(event) {
  const button = event.target.closest("[data-set-action]");
  if (!button) return false;
  if (button.dataset.setAction === "open") { openSetDialog(button); return true; }
  if (button.dataset.setAction === "close") { closeSetDialog(); return true; }
  const rows = button.closest(".set-log-dialog")?.querySelector(".set-log-rows");
  if (!rows) return false;
  if (button.dataset.setAction === "remove") {
    button.closest(".set-log-row").remove();
    [...rows.children].forEach((row,index)=>{
      const number=index+1;
      row.querySelector(":scope > span").textContent=number;
      row.querySelector('[name="reps"]').closest("label").querySelector("span").textContent=`Set ${number} reps`;
      row.querySelector('[name="weight"]').closest("label").querySelector("span").textContent=`Set ${number} weight in kilograms`;
      row.querySelector('[data-set-action="remove"]').setAttribute("aria-label",`Remove set ${number}`);
    });
    return true;
  }
  if (rows.children.length >= 20) return true;
  rows.insertAdjacentHTML("beforeend", setRow({set_number: rows.children.length + 1, reps: "", weight_kg: ""}));
  rows.lastElementChild.querySelector('[name="reps"]')?.focus();
  return true;
}

export async function handleSetSubmit(event) {
  const form = event.target.closest(".set-log-form");
  if (!form) return false;
  event.preventDefault();
  const details = form.closest(".set-log-dialog"), notice = form.querySelector(".set-log-notice");
  const rows = [...form.querySelectorAll(".set-log-row")];
  const sets = [];
  for (const [index, row] of rows.entries()) {
    const reps = row.querySelector('[name="reps"]').value;
    const weight = row.querySelector('[name="weight"]').value;
    if (reps === "" && weight === "") continue;
    if (reps === "") { notice.textContent = `Enter reps for set ${index + 1}.`; return true; }
    sets.push({set_number: index + 1, reps: Number(reps), weight_kg: weight === "" ? null : Number(weight)});
  }
  notice.textContent = "Saving…";
  const save = form.querySelector('[type="submit"]');
  save.disabled = true;
  try {
    const response = await fetch(endpoint, {method: "PUT", headers: {"Content-Type": "application/json", Authorization: `Bearer ${token()}`}, body: JSON.stringify({workout_date: details.dataset.setDate || today(), exercise_name: details.dataset.setExercise, sets})});
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Could not save sets.");
    workoutSets = workoutSets.filter(item => item.workout_date !== details.dataset.setDate || item.exercise_name !== details.dataset.setExercise).concat(data);
    notice.textContent = sets.length ? "Sets saved." : "Sets cleared.";
    document.querySelectorAll(".set-log").forEach(source => {
      if (source.dataset.setDate !== details.dataset.setDate || source.dataset.setExercise !== details.dataset.setExercise) return;
      const trigger = source.querySelector(".set-log-trigger");
      trigger.textContent = data.length ? "View / Edit Sets" : "Log Sets";
      trigger.setAttribute("aria-label", `${data.length ? "View or edit" : "Log"} sets for ${details.dataset.setExercise}`);
    });
    closeSetDialog();
    window.dispatchEvent(new Event("workout-sets-updated"));
  } catch (error) { notice.textContent = error.message; save.disabled = false; }
  return true;
}

document.addEventListener("click", event => {
  if (event.target.classList?.contains("set-log-overlay")) { closeSetDialog(); return; }
  handleSetClick(event);
});
document.addEventListener("submit", event => { if (event.target.matches(".set-log-form")) handleSetSubmit(event); });
document.addEventListener("keydown", event => {
  const dialog = document.querySelector(".set-log-dialog");
  if (!dialog) return;
  if (event.key === "Escape") { closeSetDialog(); return; }
  if (event.key !== "Tab") return;
  const focusable = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled)")];
  if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
});
