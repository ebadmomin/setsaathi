import { useEffect, useState } from "react";
import { API_BASE } from "./api-config.js";
import "./member-reminders.css";

export default function MemberReminders() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const token = localStorage.getItem("setsaathi_token");
    if (!token) return undefined;
    const controller = new AbortController();
    const refresh = () => fetch(`${API_BASE}/api/reminders`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data) setItems((data.reminders || []).filter(item => !item.seen_at)); })
      .catch(() => {});
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    const timer = window.setInterval(onVisible, 60000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  if (!items.length) return null;
  const dismiss = async id => {
    const item = items.find(entry => entry.id === id);
    setItems(current => current.filter(item => item.id !== id));
    const token = localStorage.getItem("setsaathi_token");
    try {
      const response = await fetch(`${API_BASE}/api/reminders/${id}/seen`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not dismiss reminder.");
    } catch { if (item) setItems(current => current.some(entry => entry.id === id) ? current : [item, ...current]); }
  };
  return <aside className="member-reminder" role="status" aria-label="Membership reminder"><div><strong>Membership reminder</strong><p>{items[0].message}</p></div><button type="button" onClick={() => dismiss(items[0].id)} aria-label="Dismiss reminder">×</button></aside>;
}
