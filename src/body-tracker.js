import {API_BASE} from "./api-config.js";
const bodyTrackerApi = `${API_BASE}/api/body-measurements`;
let bodyTrackerRecords = [];

const bodyDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const bodyEscape = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[character]);

function bodyBmiCategory(bmi) {
  if (!Number.isFinite(bmi) || bmi <= 0) return null;
  if (bmi < 18.5) return { label: "Underweight", className: "underweight" };
  if (bmi < 25) return { label: "Healthy weight", className: "healthy" };
  if (bmi < 30) return { label: "Overweight", className: "overweight" };
  return { label: "Obesity", className: "obesity" };
}

function bodyChange(records) {
  if (records.length < 2) return { text: "Add another entry", className: "neutral", baseline: "" };
  const change = +(records.at(-1).weight_kg - records[0].weight_kg).toFixed(1);
  const baseline = `Since ${bodyShortDate(records[0].recorded_at)}`;
  if (change < 0) return { text: `Lost ${Math.abs(change).toFixed(1)} kg`, className: "loss", baseline };
  if (change > 0) return { text: `Gained ${change.toFixed(1)} kg`, className: "gain", baseline };
  return { text: "No change", className: "neutral", baseline };
}

function bodyShortDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function bodyLongDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function bodyReadout(item) {
  return `${bodyLongDate(item.recorded_at)} · ${Number(item.weight_kg).toFixed(1)} kg`;
}

function bodyGraph(records) {
  const recent = records.slice(-30);
  if (!recent.length) return '<div class="body-chart-empty">Add your first measurement to start the graph.</div>';
  if (recent.length === 1) {
    const first = recent[0], date = new Date(`${first.recorded_at}T12:00:00`).toLocaleDateString(undefined, {day:"numeric", month:"short", year:"numeric"});
    return `<div class="body-chart-start"><span class="body-chart-start-icon" aria-hidden="true">01</span><div><small>YOUR STARTING POINT · ${bodyEscape(date)}</small><strong>${bodyEscape(first.weight_kg)} kg</strong><p>Add another measurement on a different day to see your weight trend.</p></div></div>`;
  }
  const mobile = window.matchMedia("(max-width: 600px)").matches;
  const W = mobile ? 350 : 700, H = 200, padL = mobile ? 42 : 52, padR = mobile ? 14 : 20, top = 16, bottom = 168;
  const weights = recent.map(item => Number(item.weight_kg));
  const min = Math.min(...weights), max = Math.max(...weights);
  const pad = Math.max((max - min) * 0.15, 0.5);
  const lo = min - pad, hi = max + pad, span = hi - lo;
  const xFor = index => padL + index * ((W - padL - padR) / (recent.length - 1));
  const yFor = weight => bottom - ((weight - lo) / span) * (bottom - top);
  const pts = recent.map((item, index) => ({ x: xFor(index), y: yFor(Number(item.weight_kg)) }));
  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // Y axis: top, middle and bottom weight with horizontal guide lines.
  const yAxis = [hi, (hi + lo) / 2, lo].map(value => {
    const y = yFor(value).toFixed(1);
    return `<line class="body-grid" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"></line><text class="body-y" x="${padL - 8}" y="${(yFor(value) + 4).toFixed(1)}" text-anchor="end">${value.toFixed(1)}</text>`;
  }).join("");
  // X axis: up to four evenly spaced dates, always including the first and last entry.
  const labelCount = Math.min(recent.length, mobile ? 3 : 4);
  const labelIndexes = [...new Set(Array.from({ length: labelCount }, (_, k) => Math.round((k * (recent.length - 1)) / (labelCount - 1))))];
  const xLabels = labelIndexes.map(index => {
    const anchor = index === 0 ? "start" : index === recent.length - 1 ? "end" : "middle";
    return `<text class="body-x" x="${pts[index].x.toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${bodyEscape(bodyShortDate(recent[index].recorded_at))}</text>`;
  }).join("");
  const dots = pts.map((p, index) => `<circle class="body-dot" tabindex="0" data-index="${index}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" aria-label="${bodyEscape(bodyReadout(recent[index]))}"></circle>`).join("");
  const last = recent.length - 1;
  return `<svg class="body-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight history graph">${yAxis}<polyline points="${polyline}"></polyline>${dots}${xLabels}</svg><p class="body-chart-readout" aria-live="polite">${bodyEscape(bodyReadout(recent[last]))}</p>`;
}

let chartWasMobile = window.matchMedia("(max-width: 600px)").matches;
window.addEventListener("resize", () => {
  const mobile = window.matchMedia("(max-width: 600px)").matches;
  if (mobile === chartWasMobile) return;
  chartWasMobile = mobile;
  const chart = document.querySelector(".body-tracker .body-chart-wrap");
  if (chart) chart.innerHTML = bodyGraph(bodyTrackerRecords);
});

// Tap, click, hover or keyboard focus on a point shows its exact date and weight.
["pointerover", "focusin", "click"].forEach(type => document.addEventListener(type, event => {
  const dot = event.target.closest?.(".body-dot");
  if (!dot) return;
  const item = bodyTrackerRecords.slice(-30)[Number(dot.dataset.index)];
  const readout = dot.closest(".body-chart-wrap")?.querySelector(".body-chart-readout");
  if (item && readout) readout.textContent = bodyReadout(item);
}));

function renderBodyTracker(view) {
  const latest = bodyTrackerRecords.at(-1), now = new Date(), monday = new Date(now), monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const bmi = latest?.bmi == null ? null : Number(latest.bmi);
  const bmiCategory = bodyBmiCategory(bmi);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekRecords = bodyTrackerRecords.filter(item => item.recorded_at >= bodyDateKey(monday) && item.recorded_at <= bodyDateKey(now));
  const monthRecords = bodyTrackerRecords.filter(item => item.recorded_at >= bodyDateKey(monthStart) && item.recorded_at <= bodyDateKey(now));
  const week = bodyChange(weekRecords), month = bodyChange(monthRecords);
  view.innerHTML = `<header class="body-tracker-heading"><div><p class="eyebrow">HEIGHT · WEIGHT · BMI</p><h2>Your body tracker</h2><span>Log your weight each day to see your graph and weekly or monthly change.</span></div><button type="button" class="body-entry-toggle">+ Add today’s measurement</button></header>
    <div class="body-tracker-stats"><article><small>CURRENT WEIGHT</small><strong>${latest ? `${latest.weight_kg} kg` : "—"}</strong></article><article><small>HEIGHT</small><strong>${latest ? `${latest.height_cm} cm` : "—"}</strong></article><article class="${week.className}"><small>THIS WEEK</small><strong>${week.text}</strong>${week.baseline ? `<span class="body-delta-baseline">${week.baseline}</span>` : ""}</article><article class="${month.className}"><small>THIS MONTH</small><strong>${month.text}</strong>${month.baseline ? `<span class="body-delta-baseline">${month.baseline}</span>` : ""}</article><article class="body-bmi-card ${bmiCategory ? `body-bmi-${bmiCategory.className}` : ""}"><small>BMI · ADULT CATEGORY</small><strong>${bmiCategory ? bmi.toFixed(1) : "—"}</strong>${bmiCategory ? `<span class="body-bmi-status ${bmiCategory.className}">${bmiCategory.label}</span>` : "<span class=\"body-bmi-missing\">Add height and weight</span>"}</article></div>
    <div class="body-chart-wrap">${bodyGraph(bodyTrackerRecords)}</div>
    <form class="body-entry-form" hidden><label>Date<input name="recorded_at" type="date" value="${bodyDateKey(now)}" max="${bodyDateKey(now)}" required></label><label>Height (cm)<input name="height_cm" type="number" min="100" max="250" step="0.1" value="${latest?.height_cm ?? ""}" placeholder="175" required></label><label>Weight (kg)<input name="weight_kg" type="number" min="25" max="350" step="0.1" placeholder="75.5" required></label><button type="submit">Save measurement</button><button type="button" class="body-entry-cancel">Cancel</button><p class="body-entry-message" aria-live="polite"></p></form>`;
  const form = view.querySelector("form");
  view.querySelector(".body-entry-toggle").onclick = () => { form.hidden = false; form.querySelector('[name="weight_kg"]').focus(); };
  view.querySelector(".body-entry-cancel").onclick = () => { form.hidden = true; };
  form.onsubmit = async event => {
    event.preventDefault();
    const message = form.querySelector(".body-entry-message"), button = form.querySelector('[type="submit"]'), payload = Object.fromEntries(new FormData(form));
    payload.height_cm = +payload.height_cm; payload.weight_kg = +payload.weight_kg;
    button.disabled = true; message.textContent = "Saving…";
    try {
      const response = await fetch(bodyTrackerApi, {method:"PUT", headers:{"Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`}, body:JSON.stringify(payload)}), data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not save measurement.");
      await loadBodyTracker(view);
    } catch (error) { message.textContent = error.message; button.disabled = false; }
  };
}

async function loadBodyTracker(view) {
  try {
    const response = await fetch(bodyTrackerApi, {headers:{Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`}}), data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Could not load body measurements.");
    bodyTrackerRecords = data;
    renderBodyTracker(view);
  } catch (error) {
    view.innerHTML = `<div class="body-tracker-retry"><p class="eyebrow">HEIGHT · WEIGHT · BMI</p><h2>Your body tracker</h2><p class="body-tracker-error">Could not load your measurements. ${bodyEscape(error.message)}</p><button type="button">Try again</button></div>`;
    view.querySelector("button").onclick = () => loadBodyTracker(view);
  }
}

new MutationObserver(() => {
  const summary = document.querySelector(".dashboard-summary");
  if (!summary || document.querySelector(".body-tracker")) return;
  const view = document.createElement("section");
  view.className = "body-tracker";
  view.hidden = localStorage.getItem("setsaathi_active_view") !== "dashboard";
  const membership = document.querySelector(".dashboard-grid .membership-card");
  if (membership) document.querySelector(".dashboard-grid").after(view);
  else summary.before(view);
  loadBodyTracker(view);
}).observe(document.documentElement, {childList:true, subtree:true});

document.addEventListener("click", event => {
  if (event.target.closest('.app-tabs [data-view="dashboard"]')) {
    const view = document.querySelector(".body-tracker");
    if (view) loadBodyTracker(view);
  }
});
