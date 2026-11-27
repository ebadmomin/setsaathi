import {API_BASE} from "./api-config.js";
import {SKIP_ICON_SVG, CLOSE_ICON_SVG} from "./ui-utils.js";
import {renderExerciseSteps} from "./exercise-steps.js";
const INFO_ICON_SVG='<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/></svg>';
const PLAY_ICON_SVG='<svg class="ui-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z"/></svg>';
const howToApi = `${API_BASE}/api/exercises`;

function howToEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function addHowToButtons(root = document) {
  root.querySelectorAll?.(".progress-exercise-copy > div").forEach(heading => {
    const card = heading.closest(".progress-exercise");
    const utilities = card?.querySelector(".progress-exercise-utilities");
    if (!utilities || utilities.querySelector(".exercise-how-to")) return;
    const name = heading.querySelector("h3")?.textContent.trim();
    if (!name) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "exercise-how-to";
    button.dataset.exerciseHowTo = name;
    button.innerHTML = INFO_ICON_SVG + " How to";
    button.setAttribute("aria-label", `Show how to perform ${name}`);
    utilities.insertBefore(button, utilities.querySelector(".progress-undo"));
  });
}

function closeHowTo(overlay) {
  overlay.remove();
  document.body.classList.remove("how-to-open");
}

function renderHowToModal(name) {
  const overlay = document.createElement("div");
  overlay.className = "exercise-how-to-overlay";
  overlay.innerHTML = `
    <section class="exercise-how-to-modal" role="dialog" aria-modal="true" aria-label="How to perform ${howToEscape(name)}">
      <div class="exercise-how-to-header"><button type="button" class="exercise-how-to-close modal-close-button" aria-label="Close">${CLOSE_ICON_SVG}</button></div>
      <div class="exercise-how-to-scroll">
        <p class="eyebrow">MOVEMENT GUIDE</p>
        <h2>${howToEscape(name)}</h2>
        <div class="exercise-how-to-loading">Loading demonstration…</div>
      </div>
    </section>`;
  document.body.append(overlay);
  document.body.classList.add("how-to-open");
  overlay.querySelector(".exercise-how-to-close").onclick = () => closeHowTo(overlay);
  overlay.onclick = event => {
    if (event.target === overlay) closeHowTo(overlay);
  };
  return overlay;
}

async function openHowTo(name) {
  const overlay = renderHowToModal(name);
  const content = overlay.querySelector(".exercise-how-to-loading");
  try {
    const response = await fetch(`${howToApi}?query=${encodeURIComponent(name)}`);
    const items = await response.json();
    if (!response.ok) throw new Error(items.detail || "Could not load the movement guide.");
    const exercise = items.find(item => item.name.toLowerCase() === name.toLowerCase()) || items[0];
    const media = exercise?.media_url
      ? `<div class="exercise-how-to-media"><img src="${howToEscape(exercise.media_url)}" alt="${howToEscape(name)} demonstration" loading="eager"></div>`
      : `<div class="exercise-how-to-placeholder"><span aria-hidden="true">${PLAY_ICON_SVG}</span><p>A licensed demonstration for this exercise is not in the library yet. Follow the technique notes below.</p></div>`;
    content.className = "exercise-how-to-content";
    content.innerHTML = `${media}
      ${exercise ? `<p class="exercise-how-to-meta">Target: ${howToEscape(exercise.primary_muscle || "—")} · ${howToEscape(exercise.equipment || "—")} · ${howToEscape(exercise.difficulty || "—")}</p><div class="exercise-how-to-copy"><h3>Technique</h3>${renderExerciseSteps(exercise.instructions)}<h3>Safety</h3><p>${howToEscape(exercise.safety_tips)}</p></div>` : ""}`;
  } catch (error) {
    content.className = "exercise-how-to-error";
    content.innerHTML = `<p>${howToEscape(error.message)}</p>`;
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-exercise-how-to]");
  if (button) openHowTo(button.dataset.exerciseHowTo);
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const overlay = document.querySelector(".exercise-how-to-overlay");
  if (overlay) closeHowTo(overlay);
});

new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node instanceof HTMLElement) addHowToButtons(node.matches(".progress-view") ? node : node);
    });
  }
}).observe(document.documentElement, { childList: true, subtree: true });

addHowToButtons();

window.openExerciseDetail = openHowTo;
