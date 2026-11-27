import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "./api-config.js";
import "./admin-page.css";
import StaffPortal from "./StaffPortal.jsx";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const plusMonths = (value, months) => {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const blankMember = () => ({ full_name: "", mobile: "", email: "", plan_name: "Monthly", started_at: today(), expires_at: plusMonths(today(), 1), notes: "", archived: false });
const formatDate = value => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
function membershipStatus(member) {
  if (member.archived) return "Archived";
  const start = member.started_at.slice(0, 10), end = member.expires_at.slice(0, 10), now = today();
  if (start > now) return "Upcoming";
  if (end < now) return "Expired";
  const threshold = new Date(); threshold.setDate(threshold.getDate() + 14);
  const thresholdDate = `${threshold.getFullYear()}-${String(threshold.getMonth() + 1).padStart(2, "0")}-${String(threshold.getDate()).padStart(2, "0")}`;
  return end <= thresholdDate ? "Expiring" : "Active";
}
async function adminRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}/api/admin${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("setsaathi_token")}`, ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || "Could not load gym data.");
    error.status = response.status;
    throw error;
  }
  return data;
}

const sections = ["Overview", "Members", "Gym roster", "Renewals", "Gym settings"];

export default function AdminPage({ user, signOut }) {
  if (user.role === "staff") return <StaffPortal user={user} signOut={signOut}/>;
  return <AdminWorkspace user={user} signOut={signOut}/>;
}

function AdminWorkspace({ user, signOut }) {
  const [section, setSection] = useState("Overview");
  const [workspace, setWorkspace] = useState({ gym: null, members: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankMember);
  const [gymForm, setGymForm] = useState({ name: "", address: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    try {
      const data = await adminRequest("/workspace");
      setWorkspace(data);
      if (data.gym) setGymForm(data.gym);
      setError("");
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const members = workspace.members || [];
  const counts = useMemo(() => {
    const result = { total: 0, current: 0, expiring: 0, expired: 0 };
    members.forEach(member => {
      const status = membershipStatus(member);
      if (status === "Archived") return;
      result.total += 1;
      if (status === "Active" || status === "Expiring") result.current += 1;
      if (status === "Expiring") result.expiring += 1;
      if (status === "Expired") result.expired += 1;
    });
    return result;
  }, [members]);
  const visibleMembers = useMemo(() => members.filter(member => {
    const status = membershipStatus(member);
    const matchesSearch = `${member.full_name} ${member.mobile} ${member.email} ${member.plan_name}`.toLowerCase().includes(search.toLowerCase().trim());
    const matchesFilter = filter === "All" ? status !== "Archived" : status === filter;
    const matchesSection = section !== "Renewals" || ["Expiring", "Expired"].includes(status);
    return matchesSearch && matchesFilter && matchesSection;
  }), [members, search, filter, section]);
  const urgent = members.filter(member => ["Expiring", "Expired"].includes(membershipStatus(member))).sort((a, b) => a.expires_at.localeCompare(b.expires_at)).slice(0, 5);

  const openMember = member => {
    setForm(member ? { ...member, archived: Boolean(member.archived) } : blankMember());
    setEditing(member?.id ?? "new");
    setNotice("");
  };
  const saveMember = async event => {
    event.preventDefault(); setSaving(true); setNotice("");
    try {
      const path = editing === "new" ? "/members" : `/members/${editing}`;
      await adminRequest(path, { method: editing === "new" ? "POST" : "PUT", body: JSON.stringify(form) });
      await refresh(); setEditing(null); setNotice(editing === "new" ? "Member added to your gym roster." : "Member record updated.");
    } catch (cause) { setNotice(cause.message); }
    finally { setSaving(false); }
  };
  const saveGym = async event => {
    event.preventDefault(); setSaving(true); setNotice("");
    try { await adminRequest("/gym", { method: "PUT", body: JSON.stringify(gymForm) }); await refresh(); setNotice("Gym details saved."); }
    catch (cause) { setNotice(cause.message); }
    finally { setSaving(false); }
  };
  const changePlan = value => {
    const months = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 }[value];
    setForm(previous => ({ ...previous, plan_name: value, expires_at: months ? plusMonths(previous.started_at, months) : previous.expires_at }));
  };

  return <main className="admin-page">
    <aside className="admin-sidebar">
      <div className="admin-brand"><img src="/assets/setsaathi-lifter.png?v=2" alt=""/><div><strong>SetSaathi</strong><span>GYM CONSOLE</span></div></div>
      <div className="admin-nav-label">WORKSPACE</div>
      <nav className="admin-nav" aria-label="Gym management">
        {sections.map((item, index) => <button type="button" key={item} className={section === item ? "selected" : ""} onClick={() => { setSection(item); setFilter("All"); setSearch(""); window.scrollTo({ top: 0, behavior: "instant" }); }}><span aria-hidden="true">{["▦", "◉", "☷", "↗", "⌂"][index]}</span>{item}</button>)}
      </nav>
      <div className="admin-sidebar-foot"><img className="admin-admin-avatar" src="/assets/setsaathi-icon-192.png" alt="SetSaathi lifter logo"/><div><strong>{user.name}</strong><small>Gym administrator</small></div></div>
    </aside>

    <div className="admin-main">
      <header className="admin-topbar"><div><span>GYM MANAGEMENT</span><strong>{workspace.gym?.name || "Your workspace"}</strong></div><div className="admin-topbar-actions"><span>{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span><button type="button" onClick={signOut}>Sign out</button></div></header>
      {loading ? <div className="admin-state">Loading your gym workspace…</div> : error ? <div className="admin-state admin-error" role="alert">{error}<button type="button" onClick={refresh}>Try again</button></div> : <>
        {!workspace.gym && section !== "Members" && section !== "Gym settings" && <section className="admin-setup admin-workspace-empty"><span className="admin-kicker">{section === "Renewals" ? "MEMBERSHIP FOLLOW-UP" : section === "Gym roster" ? "GYM DIRECTORY" : "GET STARTED"}</span><h1>{section === "Renewals" ? "No renewals to review yet." : section === "Gym roster" ? "Your gym roster starts here." : "Welcome to your gym workspace."}</h1><p>{section === "Renewals" ? "Renewals will show memberships nearing their end date or already expired. Set up your gym, then add member records to begin tracking them." : section === "Gym roster" ? "Create your gym workspace to keep member records, plans, and renewal dates together." : "Set up your gym to see your roster, membership status, and upcoming renewals in one place."}</p><button type="button" className="admin-primary" onClick={() => setSection("Gym settings")}>Set up gym details →</button></section>}
        {!workspace.gym && section === "Gym settings" && <section className="admin-setup"><span className="admin-kicker">WORKSPACE SETTINGS</span><h1>Set up your gym workspace.</h1><p>Add the branch you manage. Your roster and membership records will stay in this private workspace.</p><GymForm value={gymForm} onChange={setGymForm} onSubmit={saveGym} saving={saving}/></section>}
        {section === "Members" && <RegisteredMembers viewerRole="admin"/>}
        {workspace.gym && section === "Overview" && <>
          <div className="admin-page-heading"><div><span className="admin-kicker">OWNER OVERVIEW</span><h1>Good to see you, {user.name.split(" ")[0]}.</h1><p>Everything you need to keep your gym memberships on track.</p></div><button type="button" className="admin-primary" onClick={() => openMember()}>+ Add member</button></div>
          <section className="admin-hero"><div><span className="admin-kicker">YOUR GYM TODAY</span><h2>{workspace.gym.name}</h2><p>{workspace.gym.address}</p></div><div className="admin-hero-number"><strong>{counts.current}</strong><span>current members</span></div></section>
          <Stats counts={counts}/>
          <section className="admin-overview-grid"><div className="admin-panel"><div className="admin-panel-head"><div><span className="admin-kicker">NEEDS ATTENTION</span><h2>Upcoming renewals</h2></div><button type="button" onClick={() => setSection("Renewals")}>View all →</button></div>{urgent.length ? <div className="admin-renewal-list">{urgent.map(member => <button type="button" key={member.id} onClick={() => openMember(member)}><span className="admin-member-avatar">{initials(member.full_name)}</span><span><strong>{member.full_name}</strong><small>{member.plan_name} · {formatDate(member.expires_at)}</small></span><Status status={membershipStatus(member)}/></button>)}</div> : <p className="admin-empty-copy">No memberships need attention right now.</p>}</div><div className="admin-panel admin-quick-panel"><span className="admin-kicker">QUICK ACTIONS</span><h2>Keep the front desk moving.</h2><p>Add a member, update a renewal, or check your gym details in a few clicks.</p><button type="button" onClick={() => openMember()}>Add a gym roster entry <span>↗</span></button><button type="button" onClick={() => setSection("Members")}>View registered app users <span>↗</span></button><button type="button" onClick={() => setSection("Gym roster")}>Open gym roster <span>↗</span></button></div></section>
        </>}
        {workspace.gym && ["Gym roster", "Renewals"].includes(section) && <>
          <div className="admin-page-heading"><div><span className="admin-kicker">{section === "Gym roster" ? "GYM DIRECTORY" : "MEMBERSHIP FOLLOW-UP"}</span><h1>{section === "Gym roster" ? "Your gym roster" : "Renewals to review"}</h1><p>{section === "Gym roster" ? "Manage the people and plans recorded for your gym." : "See memberships expiring soon or already past their end date."}</p></div><button type="button" className="admin-primary" onClick={() => openMember()}>+ Add member</button></div>
          <Stats counts={counts}/>
          <section className="admin-panel admin-roster"><div className="admin-roster-tools"><label><span className="sr-only">Search members</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, phone, email or plan"/></label><select aria-label="Filter membership status" value={filter} onChange={event => setFilter(event.target.value)}>{(section === "Renewals" ? ["All", "Expiring", "Expired"] : ["All", "Active", "Expiring", "Expired", "Upcoming", "Archived"]).map(value => <option key={value}>{value}</option>)}</select></div><div className="admin-table-scroll"><table><thead><tr><th>Member</th><th>Contact</th><th>Plan</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>{visibleMembers.map(member => <tr key={member.id}><td><div className="admin-person"><span className="admin-member-avatar">{initials(member.full_name)}</span><strong>{member.full_name}</strong></div></td><td>{member.mobile || member.email || "—"}</td><td>{member.plan_name}</td><td>{formatDate(member.expires_at)}</td><td><Status status={membershipStatus(member)}/></td><td><button type="button" onClick={() => openMember(member)}>Edit</button></td></tr>)}</tbody></table></div>{!visibleMembers.length && <div className="admin-empty-copy">{members.length ? "No records match this view." : "Your roster is empty. Add your first member to get started."}</div>}</section>
        </>}
        {workspace.gym && section === "Gym settings" && <><div className="admin-page-heading"><div><span className="admin-kicker">WORKSPACE SETTINGS</span><h1>Gym details</h1><p>Keep your branch name and contact details current.</p></div></div><section className="admin-panel admin-settings"><GymForm value={gymForm} onChange={setGymForm} onSubmit={saveGym} saving={saving}/><p>Roster entries belong to this admin workspace. They are separate from SetSaathi member accounts.</p></section></>}
        {notice && !editing && <p className="admin-notice" role="status">{notice}</p>}
      </>}
    </div>
    {editing && <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-member-title"><div className="admin-modal-head"><div><span className="admin-kicker">MEMBER RECORD</span><h2 id="admin-member-title">{editing === "new" ? "Add a member" : "Edit member"}</h2></div><button type="button" className="modal-close-button" aria-label="Close" onClick={() => setEditing(null)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><form onSubmit={saveMember} className="admin-form"><div className="admin-form-grid"><label>Full name<input required maxLength="120" value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })}/></label><label>Mobile number<input maxLength="30" value={form.mobile} onChange={event => setForm({ ...form, mobile: event.target.value })}/></label><label>Email address<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })}/></label><label>Membership plan<select value={form.plan_name} onChange={event => changePlan(event.target.value)}>{["Monthly", "Quarterly", "Half-yearly", "Yearly", "Custom"].map(value => <option key={value}>{value}</option>)}{!["Monthly", "Quarterly", "Half-yearly", "Yearly", "Custom"].includes(form.plan_name) && <option>{form.plan_name}</option>}</select></label><label>Joined on<input required type="date" value={form.started_at} onChange={event => { const start = event.target.value, months = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 }[form.plan_name]; setForm({ ...form, started_at: start, expires_at: months && start ? plusMonths(start, months) : form.expires_at }); }}/></label><label>Expires on<input required type="date" value={form.expires_at} onChange={event => setForm({ ...form, expires_at: event.target.value })}/></label></div><label>Notes<textarea rows="3" maxLength="500" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Optional note for your team"/></label>{editing !== "new" && <label className="admin-archive"><input type="checkbox" checked={form.archived} onChange={event => setForm({ ...form, archived: event.target.checked })}/> Archive this record</label>}{notice && <p className="admin-form-error" role="alert">{notice}</p>}<div className="admin-form-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="admin-primary" disabled={saving}>{saving ? "Saving…" : "Save member"}</button></div></form></section></div>}
  </main>;
}

function AccountTable({ accounts, onAction }) {
  return <div className="admin-table-scroll"><table>
    <thead><tr><th>Account</th><th>Contact</th><th>Membership</th><th>Activity</th><th>Access</th><th>Action</th></tr></thead>
    <tbody>{accounts.map(account => <tr key={account.id}>
      <td><div className="admin-person"><span className="admin-member-avatar">{initials(account.name)}</span><span className="admin-account-cell"><strong>{account.name}</strong><small>@{account.username || "unknown"} · {account.role}</small></span></div></td>
      <td><span className="admin-account-cell"><strong>{account.email}</strong><small>{account.mobile}</small></span></td>
      <td><span className="admin-account-cell"><strong>{account.gym_name === "Independent member" ? "No gym added" : account.gym_name}</strong><small>{account.membership_plan}</small></span></td>
      <td><span className="admin-account-cell"><strong>Joined {formatDate(account.created_at)}</strong><small>Last sign-in {formatDate(account.last_login_at)}</small></span></td>
      <td><Status status={account.status === "blocked" ? "Blocked" : "Active"}/></td>
      <td><button type="button" className={account.status === "blocked" ? "admin-account-unblock" : "admin-account-block"} onClick={() => onAction(account)} aria-label={`${account.status === "blocked" ? "Unblock" : "Block"} ${account.name}`}>{account.status === "blocked" ? "Unblock" : "Block"}</button></td>
    </tr>)}</tbody>
  </table></div>;
}

function RegisteredMembers({ viewerRole = "admin" }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(null);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reason, setReason] = useState("");
  const [actionUnavailable, setActionUnavailable] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!closing) return undefined;
    const timeout = window.setTimeout(() => { setPending(null); setClosing(false); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
    return () => window.clearTimeout(timeout);
  }, [closing]);
  const closeAccountDialog = () => { if (!saving) setClosing(true); };
  const load = async () => {
    setLoading(true);
    try { const data = await adminRequest("/users"); setUsers(data.users || []); setError(""); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const changeStatus = async () => {
    if (!pending || saving) return;
    const status = pending.status === "blocked" ? "active" : "blocked";
    setSaving(true);
    setActionError("");
    try {
      await adminRequest(`/users/${pending.id}/status`, { method: "PUT", body: JSON.stringify({ status, reason: status === "blocked" ? reason.trim() : undefined }) });
      setUsers(current => current.map(account => account.id === pending.id ? { ...account, status } : account));
      setNotice(`${pending.name} ${status === "blocked" ? "has been blocked" : "can use SetSaathi again"}.`);
      setClosing(true);
    } catch (cause) {
      const missingRoute = cause.status === 404 && cause.message === "Not Found";
      setActionUnavailable(missingRoute);
      setActionError(missingRoute ? "This action is not available on this version of SetSaathi. Update the app, then try again." : cause.message);
    }
    finally { setSaving(false); }
  };
  const term = query.trim().toLowerCase();
  const visible = users.filter(account => `${account.name} ${account.username || ""} ${account.email} ${account.mobile} ${account.gym_name}`.toLowerCase().includes(term));
  return <>
    <div className="admin-page-heading admin-account-heading"><div><span className="admin-kicker">SETSAATHI ACCOUNTS</span><h1>{viewerRole === "staff" ? "Registered members" : "Member and staff accounts"}</h1><p>{viewerRole === "staff" ? "Member accounts you can assist." : "Registered members and staff who can access SetSaathi."}</p></div><div className="admin-heading-actions"><span className="admin-count">{users.length} {users.length === 1 ? "account" : "accounts"}</span><button type="button" onClick={load}>Refresh list</button></div></div>
    {notice && <p className="admin-account-notice" role="status">{notice}</p>}
    <section className="admin-panel admin-roster admin-account-roster"><div className="admin-roster-tools"><label><span className="sr-only">Search registered members</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, username, email, mobile or gym"/></label></div>
      {loading ? <p className="admin-empty-copy">Loading registered members…</p> : error ? <p className="admin-empty-copy admin-error" role="alert">{error}</p> : <><AccountTable accounts={visible} onAction={account => { setPending(account); setReason(""); setClosing(false); setActionError(""); setActionUnavailable(false); setNotice(""); }}/>{!visible.length && <p className="admin-empty-copy">{users.length ? "No accounts match your search." : "No accounts have been created yet."}</p>}</>}
    </section>
    {pending && <div className={`admin-modal-backdrop admin-account-backdrop${closing ? " is-closing" : ""}`} onMouseDown={event => { if (event.target === event.currentTarget) closeAccountDialog(); }}>
      <section className="admin-modal admin-account-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-account-dialog-title" aria-describedby="admin-account-dialog-copy" onKeyDown={event => { if (event.key === "Escape") closeAccountDialog(); }}>
        <span className="admin-kicker">ACCOUNT ACCESS</span>
        <h2 id="admin-account-dialog-title">{pending.status === "blocked" ? `Unblock this ${pending.role}?` : `Block this ${pending.role}?`}</h2>
        <p id="admin-account-dialog-copy">{pending.status === "blocked" ? `${pending.name} will be able to sign in and use SetSaathi again.` : `${pending.name} will be unable to sign in or use an existing session until unblocked.`}</p>
        {pending.status !== "blocked" && <label className="admin-block-reason">Reason shown to this person (optional)<textarea maxLength="500" rows="3" value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why access is being paused"/></label>}
        <p className="admin-account-dialog-note">This confirmation stays open until you choose an action.</p>
        {actionError && <p className="admin-form-error admin-account-error" role="alert">{actionError}</p>}
        <div className="admin-form-actions">
          <button type="button" autoFocus disabled={saving} onClick={closeAccountDialog}>{actionUnavailable ? "Close" : "Cancel"}</button>
          <button type="button" className={pending.status === "blocked" ? "admin-primary" : "admin-account-confirm-block"} disabled={saving || actionUnavailable} onClick={changeStatus}>{saving ? "Saving…" : actionUnavailable ? "Unavailable" : pending.status === "blocked" ? `Unblock ${pending.role}` : `Block ${pending.role}`}</button>
        </div>
      </section>
    </div>}
  </>;
}

function Status({ status }) { return <span className={`admin-status admin-status-${status.toLowerCase()}`}>{status}</span>; }
function Stats({ counts }) { return <section className="admin-stats"><article><span>MEMBERS ON FILE</span><strong>{counts.total}</strong><small>Your gym roster</small></article><article><span>CURRENT MEMBERS</span><strong>{counts.current}</strong><small>Memberships in date</small></article><article><span>EXPIRING SOON</span><strong>{counts.expiring}</strong><small>Within 14 days</small></article><article><span>EXPIRED</span><strong>{counts.expired}</strong><small>Follow up needed</small></article></section>; }
function GymForm({ value, onChange, onSubmit, saving }) { return <form className="admin-form admin-gym-form" onSubmit={onSubmit}><label>Gym or branch name<input required minLength="2" maxLength="120" value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} placeholder="e.g. CrossFit Andheri"/></label><label>Address<input required minLength="5" maxLength="300" value={value.address} onChange={event => onChange({ ...value, address: event.target.value })} placeholder="Street, area and city"/></label><label>Contact number<input maxLength="30" value={value.phone} onChange={event => onChange({ ...value, phone: event.target.value })} placeholder="Optional"/></label><button type="submit" className="admin-primary" disabled={saving}>{saving ? "Saving…" : "Save gym details"}</button></form>; }
