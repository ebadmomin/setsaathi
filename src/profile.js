import {API_BASE} from "./api-config.js";
import {CLOSE_ICON_SVG} from "./ui-utils.js";

const sessionKey = "setsaathi_session";
const token = () => localStorage.getItem("setsaathi_token");
const signOut = () => {
  localStorage.removeItem(sessionKey);
  localStorage.removeItem("setsaathi_token");
  location.reload();
};

function profilePanel() {
  const session = JSON.parse(localStorage.getItem(sessionKey) || "null");
  if (!session) return;
  const user = session.user;
  const overlay = document.createElement("div");
  overlay.className = "profile-overlay";
  overlay.innerHTML = `
    <section class="profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <button type="button" class="profile-close modal-close-button" aria-label="Close profile">${CLOSE_ICON_SVG}</button>
      <p class="eyebrow">MEMBER PROFILE</p>
      <h2 id="profile-title">Your account</h2>
      <div class="profile-tabs" role="tablist" aria-label="Profile sections">
        <button type="button" role="tab" id="profile-tab-overview" aria-controls="profile-overview" data-profile-tab="overview">Overview</button>
        <button type="button" role="tab" id="profile-tab-details" aria-controls="profile-details" data-profile-tab="details">Edit details</button>
        <button type="button" role="tab" id="profile-tab-security" aria-controls="profile-security" data-profile-tab="security">Security</button>
      </div>
      <div class="profile-section" id="profile-overview" role="tabpanel" aria-labelledby="profile-tab-overview">
        <div class="profile-identity"><span class="profile-initials" aria-hidden="true"></span><div><strong class="profile-name"></strong><span class="profile-handle"></span></div></div>
        <p class="profile-overview-note">Your training account, all in one place.</p>
      </div>
      <div class="profile-section" id="profile-details" role="tabpanel" aria-labelledby="profile-tab-details" hidden>
        <form class="profile-form">
          <label>Full name<input name="name" autocomplete="name" required></label>
          <label>Username<input name="username" autocomplete="username" required></label>
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label>Mobile number<input name="mobile" autocomplete="tel" required></label>
          <button class="submit">Save changes</button>
          <p class="profile-message" role="status" aria-live="polite"></p>
        </form>
      </div>
      <div class="profile-section" id="profile-security" role="tabpanel" aria-labelledby="profile-tab-security" hidden>
        <p class="profile-section-intro">Change your password to keep your account secure.</p>
        <form class="profile-password">
          <label>Current password<input name="current_password" type="password" autocomplete="current-password" required></label>
          <label>New password<input name="new_password" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required></label>
          <label>Confirm new password<input name="confirm_password" type="password" autocomplete="new-password" minlength="8" required></label>
          <button class="submit">Update password</button>
          <p class="profile-password-message" role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>`;
  document.body.append(overlay);

  overlay.querySelector(".profile-name").textContent = user.name;
  overlay.querySelector(".profile-handle").textContent = `@${user.username}`;
  overlay.querySelector(".profile-initials").textContent = user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const details = overlay.querySelector(".profile-form");
  for (const field of ["name", "username", "email", "mobile"]) details.elements[field].value = user[field] || "";

  const tabs = [...overlay.querySelectorAll("[data-profile-tab]")];
  const panels = Object.fromEntries(["overview", "details", "security"].map(name => [name, overlay.querySelector(`#profile-${name}`)]));
  const selectTab = name => {
    for (const tab of tabs) {
      const selected = tab.dataset.profileTab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
  };
  tabs.forEach(tab => tab.addEventListener("click", () => selectTab(tab.dataset.profileTab)));
  overlay.querySelector(".profile-tabs").addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const current = tabs.findIndex(tab => tab.getAttribute("aria-selected") === "true");
    const next = tabs[(current + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next.dataset.profileTab);
    next.focus();
    event.preventDefault();
  });
  selectTab("overview");

  const close = () => overlay.remove();
  overlay.querySelector(".profile-close").onclick = close;
  overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  overlay.addEventListener("keydown", event => { if (event.key === "Escape") close(); });

  details.onsubmit = async event => {
    event.preventDefault();
    const message = overlay.querySelector(".profile-message");
    message.textContent = "Saving…";
    try {
      const response = await fetch(`${API_BASE}/api/profile`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${token()}`},
        body: JSON.stringify(Object.fromEntries(new FormData(details))),
      });
      const data = await response.json();
      if (!response.ok) { message.textContent = data.detail || "Could not save details."; return; }
      localStorage.setItem(sessionKey, JSON.stringify({...session, user: data}));
      location.reload();
    } catch { message.textContent = "Could not save details. Please try again."; }
  };

  const password = overlay.querySelector(".profile-password");
  password.onsubmit = async event => {
    event.preventDefault();
    const message = overlay.querySelector(".profile-password-message");
    const fields = new FormData(password);
    if (fields.get("new_password") !== fields.get("confirm_password")) {
      message.textContent = "The new passwords do not match.";
      return;
    }
    message.textContent = "Updating…";
    try {
      const response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${token()}`},
        body: JSON.stringify({current_password: fields.get("current_password"), new_password: fields.get("new_password")}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        message.textContent = Array.isArray(data.detail) ? (data.detail[0]?.msg || "Could not update password.") : (data.detail || "Could not update password.");
        return;
      }
      password.reset();
      message.textContent = "Password updated.";
    } catch { message.textContent = "Could not update password. Please try again."; }
  };
  overlay.querySelector(".profile-close").focus();
}

function closeMenu() {
  document.querySelector(".account-menu")?.remove();
  document.querySelector(".profile-avatar")?.setAttribute("aria-expanded", "false");
}
function menu(button) {
  if (document.querySelector(".account-menu")) { closeMenu(); return; }
  const el = document.createElement("div");
  el.className = "account-menu";
  el.innerHTML = `<button class="open-profile" type="button">Profile</button><button class="menu-signout" type="button">Sign out</button>`;
  button.after(el);
  button.setAttribute("aria-expanded", "true");
  el.querySelector(".open-profile").onclick = () => { closeMenu(); profilePanel(); };
  el.querySelector(".menu-signout").onclick = signOut;
}
document.addEventListener("click", event => { if (!event.target.closest(".account-menu, .profile-avatar")) closeMenu(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
new MutationObserver(() => {
  const session = JSON.parse(localStorage.getItem(sessionKey) || "null");
  document.querySelectorAll(".plan-page nav > button").forEach(button => {
    if (!session || button.dataset.avatar) return;
    button.dataset.avatar = "true";
    button.className = "profile-avatar";
    button.textContent = session.user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    button.onclick = event => { event.preventDefault(); event.stopPropagation(); menu(button); };
  });
}).observe(document.documentElement, {childList: true, subtree: true});
