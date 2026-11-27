import {setsLabel} from "./ui-utils.js";
import {API_BASE, backendUnavailable} from "./api-config.js";
import {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import AdminPage from "./AdminPage.jsx";
import MemberReminders from "./MemberReminders.jsx";
import ForgotPassword from "./forgot-password.jsx";
import "./styles.css";
import "./membership.css";
import "./membership-edit.js";
import "./membership-edit.css";
import "./hero.css";
import "./profile.js";
import "./profile.css";
import "./welcome.js";
import "./welcome.css";
import "./polish.css";
import "./wedops-inspired.css";
import "./layout.css";
import "./welcome-simple.css";
import "./membership-banner.css";
import "./profile-avatar.css";
import "./router.js";
import "./top-tabs.js";
import "./top-tabs.css";
import "./dashboard-summary.css";
import "./workout-log.css";
import "./dashboard-panels.js";
import "./body-tracker.js";
import "./body-tracker.css";
import "./calendar-trackers.css";
import "./attendance.css";
import "./workout-log-checkin.js";
import "./workout-log-checkin.css";
import "./sunday-rest.js";
import "./calendar-monday.js";
import "./calendar-monday.css";
import "./attendance-actions.js";
import "./attendance-actions.css";
import "./coach.js";
import "./coach.css";
import "./coach-memory.css";
import "./exercise-library.js";
import "./exercise-library.css";
import "./exercise-source.css";
import "./exercise-how-to.js";
import "./exercise-how-to.css";
import "./ai-coach-label.js";
import "./workout-log-navigation.js";
import "./workout-log-navigation.css";
import "./privacy.js";
import "./scrollbar-theme.css";
import "./progress.js";
import "./progress.css";
import "./plan-phases.js";
import "./plan-phases.css";
import "./workout-plan-manager.js";
import "./missed-day-prompt.js";
import "./workout-plan-manager.css";
import "./workout-log-details.js";
import "./workout-log-details.css";
import "./plan-builder-design.js";
import "./plan-builder-design.css";
import "./gym-equipment.js";
import "./gym-equipment.css";
import "./dashboard-refresh.css";
import "./site-unified.css";
import "./hover-depth.css";
import "./visual-refresh.css";
import "./typography-refresh.css";
import "./logo.css";
import "./editorial-finish.css";
import "./form-contrast.css";
import "./ux-fixes.css";
import "./modal-close.css";
import "./studio-redesign.css";
import "./editorial-motifs.css";
import "./theme-charcoal.css";
import "./mobile-navigation.js";
import "./mobile-navigation.css";
import "./readability.css";
import "./admin-unified.css";
import "./ui-density.css";
import "./privacy.css";
import "./auth-feedback.css";
import "./type-scale.css";
import "./workout-log-charcoal.css";
import "./workout-sets.css";
const API_URL=API_BASE, SESSION="setsaathi_session", choices={goal:["Build muscle","Get stronger","Lose fat","Stay active"],experience:["Beginner","Intermediate","Expert"],days:[2,3,4,5,6],length:[30,45,60,75,90],location:["Gym","Home"],equipment:["Full gym","Dumbbells","Bodyweight"],split:["Full body","Upper/lower","Push pull legs","Muscle split"]};
const apiErrorMessage=(detail,fallback)=>typeof detail==="string"?detail:Array.isArray(detail)?detail.map(item=>typeof item?.msg==="string"?item.msg.replace(/^Value error,\s*/,""):"").filter(Boolean).join(" ")||fallback:fallback;
function Field({label,type,...props}) {
  const [visible,setVisible]=useState(false);
  const password=type==="password";
  return <label><span>{label}</span><span className={password?"password-field":"field-input"}><input {...props} type={password?(visible?"text":"password"):type} required/>{password&&<button className="password-visibility" type="button" aria-label={visible?"Hide password":"Show password"} aria-pressed={visible} onClick={()=>setVisible(!visible)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/>{!visible&&<path d="M4 20 20 4"/>}</svg></button>}</span></label>;
}
const Select=({label,value,onChange,options})=><label><span>{label}</span><select value={value} onChange={onChange}>{options.map(x=><option key={x}>{x}</option>)}</select></label>;
const readSession=()=>{try{const s=JSON.parse(localStorage.getItem(SESSION));return s?.expiresAt>Date.now()?s:null}catch{return null}};
const blockedPreview = import.meta.env.DEV && new URLSearchParams(location.search).has("blocked-preview");
function AuthNotice({ message }) {
  const blocked = message.includes("blocked from using SetSaathi");
  const network = message === "Failed to fetch" || message === backendUnavailable;
  return <div className={`auth-feedback${blocked ? " auth-feedback-blocked" : ""}`} role="alert">
    <span className="auth-feedback-icon" aria-hidden="true">!</span>
    <div className="auth-feedback-content">
      <strong>{blocked ? "ACCOUNT BLOCKED" : network ? "SIGN-IN UNAVAILABLE" : "SIGN-IN FAILED"}</strong>
      <p>{blocked ? <>You can’t access SetSaathi right now. If you think this is a mistake, email <a href="mailto:setsaathi@gmail.com">setsaathi@gmail.com</a>.{message.includes("Reason: ") && <span className="auth-blocked-reason">{message.split("Reason: ").slice(1).join("Reason: ")}</span>}</> : network ? backendUnavailable : message}</p>
    </div>
  </div>;
}
function MembershipCard({user}){const expiry=user.membership_expires_at&&new Date(user.membership_expires_at),joined=user.membership_started_at&&new Date(user.membership_started_at),days=expiry&&Math.ceil((expiry-new Date())/86400000),missing=!user.gym_name||user.gym_name==="Independent member"||!expiry,status=missing?"inactive":days<0?"expired":days<=7?"expiring":"active",needsAction=status!=="active";const [edit,setEdit]=useState(false),[message,setMessage]=useState(""),[details,setDetails]=useState({event_type:status==="inactive"?"new":"renewed",gym_name:missing?"":user.gym_name,membership_plan:user.membership_plan||"",started_at:new Date().toISOString().slice(0,10),expires_at:""});const save=async e=>{e.preventDefault();const r=await fetch(`${API_URL}/api/membership/subscriptions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`},body:JSON.stringify(details)}),d=await r.json();if(!r.ok)return setMessage(apiErrorMessage(d.detail,"Could not save membership"));localStorage.removeItem(SESSION);location.reload()};return <section className={`side-card membership-card membership-${status}`}><div className="membership-title"><div><p className="eyebrow">GYM MEMBERSHIP</p><h3>{missing?"Add your gym membership":user.gym_name}</h3></div><b>{status==="active"?"valid":status}</b></div><p className="membership-message">{status==="active"?`${days} days remaining on your plan.`:status==="expiring"?`Expires in ${Math.max(0,days)} days — renew it now.`:status==="expired"?"Your membership has expired — renew it to keep this up to date.":"Add a current membership to keep this card up to date."}</p><div className="membership-grid"><span><small>Plan</small>{missing?"Not added":user.membership_plan}</span><span><small>Joined</small>{!missing&&joined?joined.toLocaleDateString():"—"}</span><span><small>Expires</small>{!missing&&expiry?expiry.toLocaleDateString():"—"}</span><span><small>Status</small>{status==="active"?"Valid":status}</span></div>{needsAction&&<button className="membership-action" onClick={()=>setEdit(!edit)}>{status==="expiring"||status==="expired"?"Renew membership":"Add membership"}</button>}{edit&&<form className="membership-form" onSubmit={save}><Select label="Record" value={details.event_type} onChange={e=>setDetails({...details,event_type:e.target.value})} options={["new","renewed"]}/><Field label="Gym name" value={details.gym_name} onChange={e=>setDetails({...details,gym_name:e.target.value})}/><Field label="Plan name" value={details.membership_plan} onChange={e=>setDetails({...details,membership_plan:e.target.value})}/><label>Start date<input type="date" value={details.started_at} onChange={e=>setDetails({...details,started_at:e.target.value})} required/></label><label>Expiry date<input type="date" value={details.expires_at} onChange={e=>setDetails({...details,expires_at:e.target.value})} required/></label><button className="submit">Save membership</button>{message&&<p className="notice">{message}</p>}</form>}</section>}
function Plan({user,signOut}){const [form,setForm]=useState({goal:"Build muscle",experience:"Beginner",days_per_week:3,location:"Gym",equipment:"Full gym",split:"Full body",session_length:45}),[plan,setPlan]=useState(null),[message,setMessage]=useState("");const update=k=>e=>setForm({...form,[k]:["days_per_week","session_length"].includes(k)?+e.target.value:e.target.value});const make=async e=>{e.preventDefault();const r=await fetch(`${API_URL}/api/plans/generate`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`},body:JSON.stringify(form)}),d=await r.json();r.ok?setPlan(d):setMessage(apiErrorMessage(d.detail,"Could not create a plan"))};const today=plan?.days.find(x=>x.day===new Intl.DateTimeFormat("en-US",{weekday:"long"}).format(new Date()))||plan?.days[0];return <main className="plan-page"><header><div className="brand"><img className="brand-logo" src="/assets/setsaathi-lifter.png?v=2" alt="SetSaathi" /></div><nav><button onClick={signOut}>Sign out</button></nav></header><section className="plan-hero"><div><p className="eyebrow">MEMBER HOME</p><h1>Hi, {user.name.split(" ")[0]}.<br/>Train with <em>intention.</em></h1></div></section><section className="dashboard-grid"><section className="today-card">{today?<><h2>{today.day}: {today.focus}</h2>{today.exercises.map(x=><article className="today-exercise" key={x.name}><b>{x.name}</b><small>{setsLabel(x.sets)} · {x.reps} · {x.rest_seconds}s rest</small>{x.risk_note&&<div className="risk"><b>Safety note</b><span>{x.risk_note}</span></div>}</article>)}</>:<div className="plan-empty"><h2>Set up your training week.</h2></div>}</section><aside className="side-stack"><MembershipCard user={user}/><section className="side-card safety-card"><h3>Train smart.</h3><p>Change or skip any movement that feels painful.</p></section></aside></section>{!plan&&<form className="plan-editor" onSubmit={make}><h2>Build your plan</h2><div className="plan-editor-grid"><Select label="Goal" value={form.goal} onChange={update("goal")} options={choices.goal}/><Select label="Experience" value={form.experience} onChange={update("experience")} options={choices.experience}/><Select label="Training days" value={form.days_per_week} onChange={update("days_per_week")} options={choices.days}/><Select label="Session minutes" value={form.session_length} onChange={update("session_length")} options={choices.length}/><Select label="Location" value={form.location} onChange={update("location")} options={choices.location}/><Select label="Equipment" value={form.equipment} onChange={update("equipment")} options={choices.equipment}/><Select label="Split" value={form.split} onChange={update("split")} options={choices.split}/></div><button className="submit">Create my plan</button>{message&&<p className="notice">{message}</p>}</form>}</main>}
function App(){const [session,setSession]=useState(blockedPreview ? null : readSession),[mode,setMode]=useState(location.pathname==="/register"?"register":["/admin","/staff"].includes(location.pathname)?"admin":"login"),[submitting,setSubmitting]=useState(false),[form,setForm]=useState({name:"",username:"",email:"",mobile:"",password:"",identifier:""}),[message,setMessage]=useState(blockedPreview ? "Your account has been blocked from using SetSaathi. Contact setsaathi@gmail.com for help." : "");useEffect(()=>{const timer=setInterval(()=>{if(!readSession())setSession(null)},30000);return()=>clearInterval(timer)},[]);
useEffect(() => {
  if (!session) return;
  let cancelled = false;
  const checkAccess = async () => {
    const token = localStorage.getItem("setsaathi_token");
    if (!token) return;
    try {
      const response = await fetch(API_URL + "/api/auth/session", { headers: { Authorization: "Bearer " + token } });
      if (response.status !== 403) return;
      const data = await response.json().catch(() => ({}));
      if (!cancelled && typeof data.detail === "string" && data.detail.includes("blocked from using SetSaathi")) {
        localStorage.removeItem("setsaathi_token");
        localStorage.removeItem(SESSION);
        setSession(null);
        setForm({name:"",username:"",email:"",mobile:"",password:"",identifier:""});
        setMode("login");
        setMessage(data.detail);
      }
    } catch { /* Keep the member signed in during a temporary network failure. */ }
  };
  checkAccess();
  const timer = setInterval(() => { if (document.visibilityState === "visible") checkAccess(); }, 30000);
  const onVisible = () => { if (document.visibilityState === "visible") checkAccess(); };
  document.addEventListener("visibilitychange", onVisible);
  return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
}, [session]);const register=mode==="register",admin=mode==="admin",change=e=>setForm({...form,[e.target.name]:e.target.value});const submit=async e=>{e.preventDefault();setMessage("");setSubmitting(true);const body=register?{name:form.name,username:form.username,email:form.email,mobile:form.mobile,password:form.password}:{identifier:form.identifier,password:form.password,expected_role:admin?"staff_admin":"member"};try{const r=await fetch(`${API_URL}${register?"/api/auth/register":"/api/auth/login"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.headers.get("content-type")?.includes("application/json"))throw new Error(backendUnavailable);const d=await r.json();if(!r.ok)return setMessage(apiErrorMessage(d.detail,register?"Could not create account":"Could not sign in"));const next={user:d.user,expiresAt:Date.now()+30*60*1000};localStorage.setItem("setsaathi_token",d.access_token);localStorage.setItem(SESSION,JSON.stringify(next));if(d.user.role==="member")localStorage.setItem("setsaathi_active_view","dashboard");history.replaceState(null,"",d.user.role==="member"?"/dashboard":"/admin");setSession(next);window.scrollTo({top:0,behavior:"instant"})}catch(error){setMessage(error.message||backendUnavailable)}finally{setSubmitting(false)}};if(session){const signOut=()=>{localStorage.removeItem("setsaathi_token");localStorage.removeItem(SESSION);setSession(null);setForm({name:"",username:"",email:"",mobile:"",password:"",identifier:""});setMode("login");history.replaceState(null,"","/login");window.scrollTo({top:0,behavior:"instant"})};return ["admin","staff"].includes(session.user.role)?<AdminPage user={session.user} signOut={signOut}/>:<><MemberReminders/><Plan user={session.user} signOut={signOut}/></>;};if(mode==="forgot")return <main className="auth-reset-page"><section className="auth"><div className="card auth-reset-card"><img className="auth-reset-logo" src="/assets/setsaathi-lifter.png?v=2" alt="SetSaathi lifter logo" /><ForgotPassword onBack={()=>setMode("login")}/></div></section></main>;return <main><section className="hero"><img className="auth-hero-logo" src="/assets/setsaathi-lifter.png?v=2" alt="SetSaathi lifter logo" /><h1>Move with <em>purpose.</em></h1></section><section className="auth"><div className={"card auth-card auth-card-"+mode}><img className="auth-mobile-logo" src="/assets/setsaathi-lifter.png?v=2" alt="SetSaathi lifter logo" />{register&&<p className="eyebrow">START YOUR JOURNEY</p>}<h2>{register?"Create your account":admin?"Staff / Admin sign in":"Welcome back"}</h2>{!admin&&<div className="tabs"><button className={register?"active":""} onClick={()=>setMode("register")}>Create account</button><button className={!register?"active":""} onClick={()=>setMode("login")}>Member login</button></div>}<form onSubmit={submit}>{register&&<><Field label="Full name" name="name" value={form.name} onChange={change} placeholder="e.g. Aarav Sharma" autoComplete="name"/><Field label="Username" name="username" value={form.username} onChange={change} placeholder="Choose a username"/><Field label="Mobile number" name="mobile" value={form.mobile} onChange={change} placeholder="+91 98765 43210"/><Field label="Email address" name="email" type="email" value={form.email} onChange={change} placeholder="you@example.com" autoComplete="email"/></>}{!register&&<Field label={admin?"Staff or admin user ID":"Username"} name="identifier" value={form.identifier} onChange={change} placeholder={admin?"Your user ID":"Your username"}/>}<Field label="Password" name="password" type="password" value={form.password} onChange={change} minLength="8" placeholder={register?"At least 8 characters":"Your password"} autoComplete={register?"new-password":"current-password"}/><button className="submit" disabled={submitting} aria-busy={submitting}>{submitting?"Please wait…":register?"Create account":"Sign in"}</button>{message&&<AuthNotice message={message}/>} {!register&&!admin&&<button type="button" className="forgot-link" onClick={()=>setMode("forgot")}>Forgot password?</button>}{!admin&&<button type="button" className="admin-link" onClick={()=>setMode("admin")}>Staff / Admin login</button>}</form>{admin&&<p className="fine"><button className="browse" onClick={()=>setMode("login")}>← Member login</button></p>}</div></section></main>}
createRoot(document.getElementById("root")).render(<App/>);

