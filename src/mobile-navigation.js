// The member tabs become an explicit menu on narrow screens. Keep the existing
// tab buttons so the router and all section modules continue to use one source.
let currentTabs = null;
let cleanupMenu = () => {};
const mobileMenuObserver = new MutationObserver(() => {
  const tabs = document.querySelector(".plan-page > header .app-tabs");
  if (!tabs || (tabs === currentTabs && tabs.previousElementSibling?.classList.contains("mobile-nav-toggle"))) return;
  cleanupMenu();
  currentTabs = tabs;
  tabs.dataset.mobileMenuReady = "true";
  tabs.id = "member-navigation";
  tabs.setAttribute("aria-label", "Member sections");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mobile-nav-toggle";
  toggle.setAttribute("aria-controls", tabs.id);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open navigation menu");
  toggle.title = "Open menu";
  toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  tabs.before(toggle);

  const close = () => {
    tabs.classList.remove("mobile-nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation menu");
    toggle.title = "Open menu";
  };
  const onToggle = () => {
    const open = tabs.classList.toggle("mobile-nav-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    toggle.title = open ? "Close menu" : "Open menu";
  };
  const onTabClick = event => {
    if (event.target.closest("button")) close();
  };
  const onKeyDown = event => {
    if (event.key === "Escape" && tabs.classList.contains("mobile-nav-open")) {
      close();
      toggle.focus();
    }
  };
  const onOutsideClick = event => {
    if (!tabs.contains(event.target) && !toggle.contains(event.target)) close();
  };
  const desktop = matchMedia("(min-width: 701px)");
  toggle.addEventListener("click", onToggle);
  tabs.addEventListener("click", onTabClick);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("click", onOutsideClick);
  desktop.addEventListener("change", close);
  cleanupMenu = () => {
    toggle.removeEventListener("click", onToggle);
    tabs.removeEventListener("click", onTabClick);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("click", onOutsideClick);
    desktop.removeEventListener("change", close);
    toggle.remove();
  };
});
mobileMenuObserver.observe(document.documentElement, { childList: true, subtree: true });
