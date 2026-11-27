import { API_BASE } from "./api-config.js";

// Three-step plan builder: location -> goal -> split. Each choice maps onto the existing
// /api/plans/generate contract, so the server rules stay the single source of truth.
const LOCATIONS = [
  { value: "Gym", label: "Gym", detail: "Use a gym's machines, cables and free weights.", equipment: "Full gym" },
  { value: "Home", label: "Home", detail: "Train with bodyweight, or dumbbells if you have them.", equipment: "Bodyweight" },
];
const GOALS = [
  { value: "Build muscle", label: "Build muscle", detail: "Moderate loads and reps for muscle growth.", reps: "8–12 reps" },
  { value: "Lose fat", label: "Burn fat", detail: "Higher reps with shorter rests to keep the pace up.", reps: "10–15 reps" },
  { value: "Get stronger", label: "Strength / general fitness", detail: "Heavier sets with longer rests to build strength.", reps: "4–6 reps" },
];
const SPLITS = [
  { value: "Push pull legs", label: "Push · Pull · Legs (PPL)", days: 3, detail: "Push, pull and leg days. Best for 3–6 training days a week." },
  { value: "Upper/lower", label: "Upper / lower", days: 4, detail: "Alternate upper and lower body sessions. Best for 4 days a week." },
  { value: "Muscle split", label: "Body part / bro split", days: 5, detail: "One muscle group per day. Best for 5 days a week." },
  { value: "Full body", label: "Full body", days: 3, detail: "Work the whole body each session. Best for 2–3 days a week." },
];
const STEPS = ["Location", "Goal", "Split"];
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("setsaathi_token")}` });
const detailOf = data => {
  const detail = data?.detail;
  if (Array.isArray(detail)) return detail[0]?.msg || "Please check your plan choices.";
  return detail || "Could not create your plan.";
};

// Map saved server settings back onto the wizard's choices, falling back to defaults.
function initialChoices(settings) {
  const goal = GOALS.some(item => item.value === settings?.goal) ? settings.goal : "Build muscle";
  const location = LOCATIONS.some(item => item.value === settings?.location) ? settings.location : "Gym";
  const split = SPLITS.some(item => item.value === settings?.split) ? settings.split : "Full body";
  return { location, goal, split };
}

async function createPlan(choices, savedSplit) {
  const split = SPLITS.find(item => item.value === choices.split);
  const location = LOCATIONS.find(item => item.value === choices.location);
  // The server refuses to regenerate under a different split without an explicit type change first.
  if (savedSplit && savedSplit !== choices.split) {
    const typeResponse = await fetch(`${API_BASE}/api/plans/type`, {
      method: "PUT", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ split: choices.split }),
    });
    if (!typeResponse.ok) throw new Error(detailOf(await typeResponse.json().catch(() => ({}))));
  }
  const payload = {
    goal: choices.goal,
    experience: "Beginner",
    days_per_week: split.days,
    location: choices.location,
    equipment: location.equipment,
    split: choices.split,
    session_length: 60,
    spine_safety: "Standard",
  };
  const response = await fetch(`${API_BASE}/api/plans/generate`, {
    method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailOf(data));
  return data;
}

function drawBuilder(form) {
  if (form.dataset.designed) return;
  form.dataset.designed = "true";
  let step = 0;
  let savedSplit = null;
  let choices = initialChoices(null);
  let hasSavedPlan = false;

  form.innerHTML = `
    <p class="plan-builder-eyebrow">BUILD YOUR TRAINING PLAN</p>
    <p class="plan-builder-steps" aria-live="polite"></p>
    <div class="plan-builder-step"></div>
    <div class="plan-builder-nav">
      <button type="button" class="plan-builder-back-step" hidden>← Back</button>
      <button type="button" class="plan-builder-next">Next →</button>
    </div>
    <p class="plan-builder-current" aria-live="polite">Checking your saved plan…</p>
    <p class="plan-today-message" role="status" aria-live="polite"></p>`;

  const stepsLabel = form.querySelector(".plan-builder-steps");
  const body = form.querySelector(".plan-builder-step");
  const backStep = form.querySelector(".plan-builder-back-step");
  const next = form.querySelector(".plan-builder-next");
  const current = form.querySelector(".plan-builder-current");
  const message = form.querySelector(".plan-today-message");

  const cardsFor = (options, key) => options.map(option => `
      <button type="button" class="plan-type-card${choices[key] === option.value ? " selected" : ""}" data-choice="${key}" data-value="${option.value}" aria-pressed="${choices[key] === option.value}">
        <span class="plan-type-card-top"><strong>${option.label}</strong>${option.days ? `<b>${option.days} days / week</b>` : option.reps ? `<b>${option.reps}</b>` : ""}</span>
        <small>${option.detail}</small>
      </button>`).join("");

  const summary = () => `Location: ${choices.location} · Goal: ${GOALS.find(g => g.value === choices.goal).label} · Split: ${SPLITS.find(s => s.value === choices.split).label}`;

  function render() {
    stepsLabel.textContent = `Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`;
    backStep.hidden = step === 0;
    next.textContent = step === STEPS.length - 1 ? (hasSavedPlan ? "Update my plan" : "Create my plan") : "Next →";
    next.disabled = false;
    if (step === 0) {
      body.innerHTML = `<h2>Where will you train?</h2><div class="plan-type-grid" role="group" aria-label="Training location">${cardsFor(LOCATIONS, "location")}</div>`;
    } else if (step === 1) {
      body.innerHTML = `<h2>What is your goal?</h2><div class="plan-type-grid" role="group" aria-label="Training goal">${cardsFor(GOALS, "goal")}</div>`;
    } else {
      body.innerHTML = `<h2>How do you want to split your week?</h2><div class="plan-type-grid" role="group" aria-label="Workout split">${cardsFor(SPLITS, "split")}</div><p class="plan-builder-summary">${summary()}</p>`;
    }
    body.querySelectorAll(".plan-type-card").forEach(card => card.addEventListener("click", () => {
      choices[card.dataset.choice] = card.dataset.value;
      body.querySelectorAll(".plan-type-card").forEach(item => {
        const active = item === card;
        item.classList.toggle("selected", active);
        item.setAttribute("aria-pressed", String(active));
      });
    }));
  }

  backStep.addEventListener("click", () => { step = Math.max(0, step - 1); message.textContent = ""; render(); });

  next.addEventListener("click", async () => {
    if (step < STEPS.length - 1) { step += 1; message.textContent = ""; render(); return; }
    next.disabled = true;
    message.textContent = "Creating your plan…";
    try {
      const data = await createPlan(choices, savedSplit);
      localStorage.setItem("setsaathi_current_plan", JSON.stringify(data));
      localStorage.removeItem("setsaathi_plan_editing");
      localStorage.setItem("setsaathi_active_view", "plan");
      location.reload();
    } catch (error) {
      message.textContent = error.message;
      next.disabled = false;
    }
  });

  render();

  fetch(`${API_BASE}/api/plans/settings`, { headers: headers() })
    .then(async response => {
      if (response.status === 404) return null;
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not load your saved plan.");
      return data;
    })
    .then(settings => {
      savedSplit = settings?.split || null;
      hasSavedPlan = Boolean(settings);
      if (settings) {
        choices = initialChoices(settings);
        render();
      }
      current.textContent = settings ? `Current plan: ${summary()}.` : "No plan yet. Build one in three quick steps.";
    })
    .catch(error => { current.textContent = error.message; });
}

new MutationObserver(() => {
  const form = document.querySelector(".plan-editor");
  if (form) drawBuilder(form);
}).observe(document.documentElement, { childList: true, subtree: true });
