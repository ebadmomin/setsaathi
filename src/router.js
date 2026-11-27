// Client-side URL routing for the member app.
// The existing tab modules keep reading `setsaathi_active_view` from localStorage.
// This adapter makes the URL the source of truth: it syncs the view from the path on load,
// pushes a history entry on every tab change, handles Back/Forward, and resets scroll.
const VIEW_KEY = "setsaathi_active_view";
const LOG_DATE_KEY = "setsaathi_log_date";
const ROUTES = {
  dashboard: "/dashboard",
  gym: "/gym",
  log: "/workout-log",
  plan: "/workout-plan",
  library: "/exercise-library",
  progress: "/progress",
  coach: "/ai-coach",
};
const LABEL_VIEWS = {
  Dashboard: "dashboard",
  Gym: "gym",
  "Workout log": "log",
  "Workout plan": "plan",
  "Exercise library": "library",
  "Today's Workout": "progress",
  "AI Coach": "coach",
};
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); routing still works from the URL.
  }
}

export function viewFromPath(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const match = Object.entries(ROUTES).find(([, route]) => route === clean);
  return match ? match[0] : null;
}

export function routeFor(view, date) {
  const route = ROUTES[view] || ROUTES.dashboard;
  if (view === "log" && date && DATE_PATTERN.test(date)) return `${route}?date=${date}`;
  return route;
}

function viewForButton(button) {
  return button.dataset.view || LABEL_VIEWS[button.textContent.trim()] || null;
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: "instant" });
}

let applyingHistory = false;

function syncFromLocation() {
  const params = new URLSearchParams(location.search);
  const date = params.get("date");
  if (date && DATE_PATTERN.test(date)) writeStorage(LOG_DATE_KEY, date);
  const view = viewFromPath(location.pathname);
  if (view) {
    writeStorage(VIEW_KEY, view);
    return view;
  }
  // Root and unknown URLs always open the member home.
  return "dashboard";
}

function clickTab(view) {
  const button = [...document.querySelectorAll(".app-tabs button")].find(
    item => viewForButton(item) === view,
  );
  button?.click();
}

// Initial load: a fresh sign-in starts on Dashboard, regardless of the last tab
// saved by a previous member session. Explicit member URLs still deep-link.
let signedIn = false;
let signedInRole = null;
try {
  const session = JSON.parse(readStorage("setsaathi_session") || "null");
  signedIn = Boolean(session?.expiresAt > Date.now() && readStorage("setsaathi_token"));
  signedInRole = signedIn ? session.user?.role : null;
} catch { /* A malformed session is treated as signed out. */ }
const authPath = ["/login", "/register", "/admin", "/staff", "/forgot-password"].includes(location.pathname);
let initialView = authPath ? "dashboard" : syncFromLocation();
if (!signedIn && !authPath) {
  history.replaceState(null, "", "/login");
  initialView = "dashboard";
} else if (signedInRole === "member" && authPath) {
  writeStorage(VIEW_KEY, "dashboard");
  history.replaceState(null, "", ROUTES.dashboard);
} else if (!authPath && location.pathname !== routeFor(initialView, readStorage(LOG_DATE_KEY))) {
  history.replaceState(null, "", routeFor(initialView, readStorage(LOG_DATE_KEY)));
}

// Tab clicks (user or programmatic) update the URL. Runs after the tab's own handler.
document.addEventListener("click", event => {
  const button = event.target.closest?.(".app-tabs button");
  if (!button || applyingHistory) return;
  const view = viewForButton(button);
  if (!view) return;
  const target = routeFor(view, view === "log" ? readStorage(LOG_DATE_KEY) : null);
  if (location.pathname + location.search !== target) history.pushState(null, "", target);
  scrollTop();
});

// Back/Forward: switch the view that the URL now describes.
window.addEventListener("popstate", () => {
  const view = syncFromLocation();
  scrollTop();
  applyingHistory = true;
  try {
    clickTab(view);
  } finally {
    applyingHistory = false;
  }
});

// Deep links to a non-dashboard view need the tab bar to exist before we activate it.
if (initialView !== "dashboard") {
  const activate = () => {
    if (document.querySelector(".app-tabs")) {
      applyingHistory = true;
      try {
        clickTab(initialView);
      } finally {
        applyingHistory = false;
      }
      return true;
    }
    return false;
  };
  if (!activate()) {
    const observer = new MutationObserver(() => {
      if (activate()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}
