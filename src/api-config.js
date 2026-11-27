// Vite proxies /api to the local Worker; production uses the same-origin Worker.
// Set VITE_API_BASE_URL only when intentionally testing a separate API.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const backendUnavailable = import.meta.env.DEV
  ? "The local sign-in service is unavailable. Start the Cloudflare Worker on port 8787 and try again."
  : "The sign-in service is unavailable right now. Please try again shortly.";
