import {API_BASE} from "./api-config.js";
const membershipEditApi = `${API_BASE}/api/membership/subscriptions`;
const membershipPlanOptions = ["Monthly", "Quarterly", "Half-yearly", "Yearly"];
const membershipPlanMonths = {Monthly:1, Quarterly:3, "Half-yearly":6, Yearly:12};

function membershipEndDate(start, months) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !months) return "";
  const [year, month, day] = start.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function setReactInput(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", {bubbles:true}));
  input.dispatchEvent(new Event("change", {bubbles:true}));
}

function attachPlanDropdown(form) {
  if (!form || form.querySelector(".membership-plan-select")) return;
  const original = form.classList.contains("membership-edit-form")
    ? form.elements.membership_plan
    : [...form.querySelectorAll("label")].find(label => label.textContent.trim() === "Plan name")?.querySelector("input");
  if (!original) return;
  const label = original.closest("label");
  const select = document.createElement("select");
  select.className = "membership-plan-select";
  select.setAttribute("aria-label", "Membership plan");
  select.required = true;
  select.innerHTML = '<option value="">Select plan</option>' + membershipPlanOptions.map(option => `<option value="${option}">${option}</option>`).join("") + '<option value="Custom">Custom</option>';
  const custom = document.createElement("input");
  custom.className = "membership-plan-custom";
  custom.placeholder = "Enter your gym’s plan name";
  custom.maxLength = 60;
  custom.setAttribute("aria-label", "Custom membership plan name");
  original.classList.add("membership-plan-original");
  original.required = false;
  label.append(select, custom);
  const setValue = value => form.classList.contains("membership-edit-form") ? original.value = value : setReactInput(original, value);
  const dateInput = form.classList.contains("membership-edit-form")
    ? form.elements.started_at
    : [...form.querySelectorAll('input[type="date"]')][0];
  const expiryInput = form.classList.contains("membership-edit-form")
    ? form.elements.expires_at
    : [...form.querySelectorAll('input[type="date"]')][1];
  const calculateExpiry = () => {
    const end = membershipEndDate(dateInput?.value, membershipPlanMonths[select.value]);
    if (!end || !expiryInput) return;
    if (form.classList.contains("membership-edit-form")) expiryInput.value = end;
    else setReactInput(expiryInput, end);
  };
  const scheduleCalculation = () => setTimeout(calculateExpiry, 0);
  dateInput?.addEventListener("change", scheduleCalculation);
  const hint = document.createElement("small");
  hint.className = "membership-expiry-hint";
  hint.textContent = "Expiry fills automatically for fixed durations. You can adjust it.";
  expiryInput?.closest("label")?.append(hint);
  const sync = value => {
    select.value = membershipPlanOptions.includes(value) ? value : value ? "Custom" : "";
    custom.hidden = select.value !== "Custom";
    custom.required = select.value === "Custom";
    custom.value = select.value === "Custom" ? value : "";
  };
  select.onchange = () => {
    const isCustom = select.value === "Custom";
    custom.hidden = !isCustom;
    custom.required = isCustom;
    if (isCustom) { setValue(custom.value); custom.focus(); }
    else { setValue(select.value); scheduleCalculation(); }
  };
  custom.oninput = () => setValue(custom.value);
  form.addEventListener("membership-plan-refresh", () => sync(original.value));
  sync(original.value);
}

function attachMembershipEdit() {
  const card = document.querySelector(".membership-card");
  if (!card || card.querySelector(".membership-edit-icon")) return;
  const status = card.querySelector(".membership-title > b");
  if (!status) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "membership-edit-icon";
  button.setAttribute("aria-label", "Edit gym membership");
  button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  status.after(button);

  const form = document.createElement("form");
  form.className = "membership-edit-form";
  form.hidden = true;
  form.innerHTML = `<h4>Edit membership details</h4><div class="membership-edit-fields"><label>Gym name<input name="gym_name" maxlength="120" required></label><label>Plan name<input name="membership_plan" maxlength="60" required></label><label>Joined<input name="started_at" type="date" required></label><label>Expires<input name="expires_at" type="date" required></label></div><div class="membership-edit-actions"><button type="submit">Save changes</button><button type="button" class="membership-edit-cancel">Cancel</button></div><p class="membership-edit-message" role="status"></p>`;
  card.append(form);
  attachPlanDropdown(form);
  button.onclick = () => {
    const session = JSON.parse(localStorage.getItem("setsaathi_session") || "null");
    const user = session?.user;
    if (!user) return;
    form.elements.gym_name.value = user.gym_name === "Independent member" ? "" : user.gym_name || "";
    form.elements.membership_plan.value = user.membership_plan || "";
    form.dispatchEvent(new Event("membership-plan-refresh"));
    form.elements.started_at.value = user.membership_started_at?.slice(0, 10) || "";
    form.elements.expires_at.value = user.membership_expires_at?.slice(0, 10) || "";
    form.querySelector(".membership-edit-message").textContent = "";
    form.hidden = !form.hidden;
    button.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) form.elements.gym_name.focus();
  };
  form.querySelector(".membership-edit-cancel").onclick = () => {
    form.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  form.onsubmit = async event => {
    event.preventDefault();
    const save = form.querySelector('[type="submit"]'), message = form.querySelector(".membership-edit-message");
    const payload = {event_type:"updated", ...Object.fromEntries(new FormData(form))};
    save.disabled = true;
    message.textContent = "Saving…";
    try {
      const response = await fetch(membershipEditApi, {method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`}, body:JSON.stringify(payload)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not update membership.");
      const session = JSON.parse(localStorage.getItem("setsaathi_session") || "null");
      if (session) localStorage.setItem("setsaathi_session", JSON.stringify({...session, user:data}));
      location.reload();
    } catch (error) {
      message.textContent = error.message;
      save.disabled = false;
    }
  };
}

new MutationObserver(() => {
  attachMembershipEdit();
  attachPlanDropdown(document.querySelector(".membership-form"));
}).observe(document.documentElement, {childList:true, subtree:true});
