import {API_BASE} from "./api-config.js";
const gymEquipmentApi = API_BASE;
const gymEquipmentHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("setsaathi_token")}` });
let gymEquipmentCatalog = {};
const equipmentLabel = name => ({
  "Hip Abductor Machine": "Hip Abductor Machine · outer thigh",
  "Hip Adductor Machine": "Hip Adductor Machine · inner thigh",
})[name] || name;

function gymEquipmentOption(name, checked) {
  const row = document.createElement("div");
  row.className = "gym-equipment-option";
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = name;
  input.checked = checked;
  const caption = document.createElement("span");
  caption.textContent = equipmentLabel(name);
  label.append(input, caption);
  const help = document.createElement("a");
  help.className = "gym-equipment-help";
  help.textContent = "See image";
  help.setAttribute("aria-label", `See Google Images for ${name} in a new tab`);
  help.title = `Search Google Images for ${name} in a new tab`;
  help.href = `https://www.google.com/search?udm=2&q=${encodeURIComponent(`${name} gym equipment`)}`;
  help.target = "_blank";
  help.rel = "noopener noreferrer";
  row.append(label, help);
  return row;
}

function gymEquipmentGroup(title, items, selected) {
  const group = document.createElement("section");
  group.className = "gym-equipment-group";
  const heading = document.createElement("h4");
  heading.textContent = title;
  if (title === "Strength machines") {
    const note = document.createElement("p");
    note.className = "gym-equipment-group-note";
    note.textContent = "Abductor moves legs outward; adductor moves them inward. Select both if one machine supports both movements.";
    group.append(heading, note);
  } else group.append(heading);
  const choices = document.createElement("div");
  choices.className = "gym-equipment-group-options";
  choices.append(...items.map(name => gymEquipmentOption(name, selected.includes(name))));
  group.append(choices);
  return group;
}

function renderGymEquipmentList(section, state) {
  ensureGymFilter(section);
  section.querySelector(".gym-equipment-options").replaceChildren(...Object.entries(gymEquipmentCatalog).map(([title, items]) => gymEquipmentGroup(title, items, state.equipment)));
  applyGymFilter(section);
  const shared = section.querySelector(".gym-equipment-shared");
  shared.replaceChildren();
  if (state.equipment.length) {
    for (const name of state.equipment) {
      const tag = document.createElement("span");
      tag.textContent = equipmentLabel(name);
      shared.append(tag);
    }
  } else {
    const empty = document.createElement("p");
    empty.textContent = !state.gym_name || state.gym_name === "Independent member"
      ? "Add your gym membership first. Then you can match its address and report the machines available there."
      : state.location
        ? "No equipment reported yet. Add machines to help tailor plans to this gym; bodyweight exercises remain available."
        : "Add your gym's address to match the right location. Its equipment list helps us suggest workouts using machines available there.";
    shared.append(empty);
  }
}

function paintGymEquipment(section, state) {
  const hasGym = state.gym_name && state.gym_name !== "Independent member";
  section.querySelector(".gym-equipment-name").textContent = hasGym ? state.gym_name : "Add your gym membership";
  section.querySelector(".gym-equipment-branch").textContent = hasGym
    ? state.location || "Gym address not added"
    : "Add a membership to connect this page to your gym.";
  section.querySelector(".gym-equipment-location").value = state.location || "";
  const badge = section.querySelector(".gym-place-badge");
  badge.hidden = !hasGym;
  badge.textContent = state.place_ref ? "OpenStreetMap listing matched" : "Address not matched";
  badge.classList.toggle("is-matched", Boolean(state.place_ref));
  badge.title = state.place_ref ? `Member selected listing: ${state.listed_name || state.gym_name}. This does not verify gym ownership.` : "Search and select a listing to match this gym's name and address.";
  section.querySelector(".gym-place-attribution").hidden = !state.place_ref;
  section.querySelector(".gym-equipment-count").textContent = hasGym ? `${state.equipment.length} gym items reported` : "";
  renderGymEquipmentList(section, state);
  const editButton = section.querySelector(".gym-equipment-edit");
  editButton.disabled = false;
  editButton.textContent = !hasGym ? "Add membership first" : state.location ? "Edit gym details" : "Add gym details";
}

async function previewGymBranch(section) {
  const location = section.querySelector(".gym-equipment-location").value.trim();
  if (location.length < 2) return;
  const message = section.querySelector(".gym-equipment-message");
  message.textContent = "Checking saved equipment for this branch…";
  try {
    const query = new URLSearchParams({ location });
    if (section.placeToken) query.set("place_token", section.placeToken);
    const response = await fetch(`${gymEquipmentApi}/api/gyms/equipment?${query}`, { headers: gymEquipmentHeaders() });
    if (!response.ok) throw new Error("Could not load this branch's equipment.");
    const state = await response.json();
    renderGymEquipmentList(section, state);
    message.textContent = state.equipment.length ? "Existing equipment loaded. Edit the checklist, then save." : "No equipment saved for this branch yet.";
  } catch (error) {
    message.textContent = error.message;
  }
}

function showGymCandidates(section, candidates) {
  const panel = section.querySelector(".gym-place-results");
  panel.replaceChildren();
  if (!candidates.length) {
    panel.textContent = "No matching listing found. Enter the full address manually and save it as unmatched.";
    return;
  }
  const title = document.createElement("p");
  title.textContent = "Choose the exact gym branch:";
  panel.append(title);
  for (const candidate of candidates) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "gym-place-choice";
    const name = document.createElement("strong");
    name.textContent = candidate.name;
    const address = document.createElement("small");
    address.textContent = candidate.address;
    option.append(name, address);
    option.onclick = () => {
      section.placeToken = candidate.token;
      section.querySelector(".gym-equipment-location").value = candidate.address;
      section.querySelector(".gym-place-selected").firstChild.textContent = `Selected listing: ${candidate.name}. Confirm the address before saving. `;
      panel.replaceChildren();
      previewGymBranch(section);
    };
    panel.append(option);
  }
  const credit = document.createElement("small");
  credit.className = "gym-place-credit";
  credit.textContent = "Search results © OpenStreetMap contributors";
  panel.append(credit);
}

async function findGym(section) {
  const area = section.querySelector(".gym-equipment-location").value.trim();
  const message = section.querySelector(".gym-equipment-message");
  if (area.length < 3) {
    message.textContent = "Enter your gym's area or address first.";
    return;
  }
  const button = section.querySelector(".gym-place-search");
  button.disabled = true;
  message.textContent = "Looking for the gym's name and address…";
  try {
    const response = await fetch(`${gymEquipmentApi}/api/gyms/search?area=${encodeURIComponent(area)}`, { headers: gymEquipmentHeaders() });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Gym lookup unavailable.");
    showGymCandidates(section, result);
    message.textContent = result.length ? "Select the matching listing, or keep your own address." : "Enter the full address manually if the gym is not listed.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function loadGymEquipment(section) {
  const message = section.querySelector(".gym-equipment-message");
  message.textContent = "Loading gym details…";
  try {
    const headers = gymEquipmentHeaders();
    const [catalogResponse, gymResponse] = await Promise.all([
      fetch(`${gymEquipmentApi}/api/gyms/equipment/catalog`, { headers }),
      fetch(`${gymEquipmentApi}/api/gyms/equipment`, { headers }),
    ]);
    if (!catalogResponse.ok || !gymResponse.ok) throw new Error("Could not load gym equipment.");
    gymEquipmentCatalog = await catalogResponse.json();
    paintGymEquipment(section, await gymResponse.json());
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}

async function saveGymEquipment(event) {
  event.preventDefault();
  const section = event.currentTarget.closest(".gym-equipment-section");
  const button = section.querySelector(".gym-equipment-save");
  const message = section.querySelector(".gym-equipment-message");
  const location = section.querySelector(".gym-equipment-location").value.trim();
  const equipment = [...section.querySelectorAll(".gym-equipment-options input:checked")].map(input => input.value);
  button.disabled = true;
  message.textContent = "Saving equipment…";
  try {
    const response = await fetch(`${gymEquipmentApi}/api/gyms/equipment`, {
      method: "PUT",
      headers: { ...gymEquipmentHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ location, equipment, place_token: section.placeToken || null }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Check the location and equipment selection.");
    section.placeToken = null;
    paintGymEquipment(section, result);
    section.querySelector(".gym-equipment-editor").hidden = true;
    section.querySelector(".gym-equipment-edit").setAttribute("aria-expanded", "false");
    message.textContent = "Saved. New workout plans will use this gym's equipment list.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function openGymEquipmentEditor(section) {
  const editor = section.querySelector(".gym-equipment-editor");
  editor.hidden = !editor.hidden;
  section.querySelector(".gym-equipment-edit").setAttribute("aria-expanded", String(!editor.hidden));
  if (!editor.hidden) section.querySelector(".gym-equipment-location").focus();
}

new MutationObserver(() => {
  const membership = document.querySelector(".dashboard-grid .membership-card");
  if (!membership || document.querySelector(".gym-equipment-section")) return;
  const section = document.createElement("section");
  section.className = "gym-equipment-section";
  section.hidden = localStorage.getItem("setsaathi_active_view") !== "gym";
  section.innerHTML = `<div class="gym-equipment-top"><div><p class="eyebrow">YOUR GYM</p><h2 class="gym-equipment-name">Loading gym…</h2><p class="gym-equipment-branch"></p><span class="gym-place-badge"></span> <a class="gym-place-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" hidden>© OpenStreetMap contributors</a></div><div class="gym-equipment-top-actions"><span class="gym-equipment-count"></span><button type="button" class="gym-equipment-edit" aria-expanded="false">Add gym details</button></div></div><div class="gym-equipment-summary"><h3>Equipment available at this gym</h3><div class="gym-equipment-shared"></div></div><form class="gym-equipment-editor" hidden><div class="gym-equipment-form-heading"><h3>Confirm this gym and its machines</h3><p>Search for your gym's exact branch, choose the matching listing, then check the machines you can use there. Uncheck machines that have been removed.</p></div><div class="gym-place-input-row"><label class="gym-equipment-location-label">Gym area or full address<input class="gym-equipment-location" maxlength="300" minlength="2" placeholder="e.g. Bandra West, Mumbai" required></label><button type="button" class="gym-place-search">Find gym</button></div><p class="gym-place-selected" aria-live="polite">If no listing matches, enter the full address manually. <a class="gym-place-external" href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">Open map search ↗</a></p><div class="gym-place-results"></div><div class="gym-equipment-options"></div><div class="gym-equipment-actions"><button class="gym-equipment-save" type="submit">Save gym details</button></div></form><p class="gym-equipment-message" role="status" aria-live="polite"></p>`;
  membership.closest(".dashboard-grid").after(section);
  section.querySelector(".gym-equipment-edit").onclick = () => {
    const name = section.querySelector(".gym-equipment-name").textContent;
    if (name === "Add your gym membership") {
      document.querySelector('.app-tabs [data-view="dashboard"]')?.click();
      document.querySelector(".membership-action")?.click();
      document.querySelector(".membership-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    openGymEquipmentEditor(section);
  };
  section.querySelector(".gym-place-search").onclick = () => findGym(section);
  section.querySelector(".gym-place-external").onclick = event => {
    const query = `${section.querySelector(".gym-equipment-name").textContent} ${section.querySelector(".gym-equipment-location").value.trim()}`.trim();
    event.currentTarget.href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
  };
  section.querySelector(".gym-equipment-location").addEventListener("input", () => {
    section.placeToken = null;
    section.querySelector(".gym-place-selected").firstChild.textContent = "Address edited. Search again to match a listing, or save this address as unmatched. ";
    section.querySelector(".gym-place-results").replaceChildren();
  });
  section.querySelector(".gym-equipment-location").addEventListener("change", () => previewGymBranch(section));
  section.querySelector("form").addEventListener("submit", saveGymEquipment);
  loadGymEquipment(section);
}).observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("open-gym-equipment", () => {
  document.querySelector('.app-tabs [data-view="gym"]')?.click();
  const section = document.querySelector(".gym-equipment-section");
  if (!section) return;
  const editor = section.querySelector(".gym-equipment-editor");
  if (editor.hidden) openGymEquipmentEditor(section);
  section.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Search and category chips over the machine checklist. Filtering only hides rows, so the
// checked state and saved selections stay intact.
function ensureGymFilter(section) {
  const options = section.querySelector(".gym-equipment-options");
  if (!options || section.querySelector(".gym-equipment-filter")) return;
  const bar = document.createElement("div");
  bar.className = "gym-equipment-filter";
  bar.innerHTML = '<label class="gym-equipment-search"><span class="gym-equipment-search-label">Search machines</span><input type="search" class="gym-equipment-filter-input" placeholder="Search, e.g. leg press"></label><div class="gym-equipment-chips" role="group" aria-label="Machine category"></div><p class="gym-equipment-filter-empty" hidden>No machines match that search. Try another word or category.</p>';
  const chips = bar.querySelector(".gym-equipment-chips");
  for (const title of ["All", ...Object.keys(gymEquipmentCatalog)]) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "gym-equipment-chip";
    chip.dataset.category = title;
    chip.textContent = title;
    chip.setAttribute("aria-pressed", String(title === "All"));
    chips.append(chip);
  }
  options.before(bar);
  section.gymFilter = { query: "", category: "All" };
  bar.querySelector("input").addEventListener("input", event => {
    section.gymFilter.query = event.target.value.trim().toLowerCase();
    applyGymFilter(section);
  });
  chips.addEventListener("click", event => {
    const chip = event.target.closest(".gym-equipment-chip");
    if (!chip) return;
    section.gymFilter.category = chip.dataset.category;
    chips.querySelectorAll(".gym-equipment-chip").forEach(item => item.setAttribute("aria-pressed", String(item === chip)));
    applyGymFilter(section);
  });
}

function applyGymFilter(section) {
  const { query = "", category = "All" } = section.gymFilter || {};
  let visible = 0;
  section.querySelectorAll(".gym-equipment-group").forEach(group => {
    const title = group.querySelector("h4")?.textContent.trim();
    const inCategory = category === "All" || title === category;
    let shown = 0;
    group.querySelectorAll("label").forEach(label => {
      const show = inCategory && (!query || label.textContent.toLowerCase().includes(query));
      label.hidden = !show;
      if (show) shown += 1;
    });
    group.hidden = shown === 0;
    visible += shown;
  });
  const empty = section.querySelector(".gym-equipment-filter-empty");
  if (empty) empty.hidden = visible > 0;
}
