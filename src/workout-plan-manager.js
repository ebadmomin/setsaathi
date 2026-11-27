import {setsLabel} from "./ui-utils.js";
import {API_BASE} from "./api-config.js";
const managedPlanApi=`${API_BASE}/api/plans/current`;
const managedPlanKey="setsaathi_current_plan";
const managedPlanEditKey="setsaathi_plan_editing";
const managedPlanEscape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const phaseCaps={Beginner:{"Warm-up":3,Main:10,Finisher:3},Intermediate:{"Warm-up":5,Main:11,Finisher:5},Expert:{"Warm-up":6,Main:13,Finisher:7}};
let managedExperience="Beginner";

async function fetchManagedPlan(){
  try{const settings=await fetch(`${API_BASE}/api/plans/settings`,{headers:{Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`}});if(settings.ok)managedExperience=(await settings.json()).experience||"Beginner"}catch{/* The saved plan can still be shown while settings are unavailable. */}
  try{const response=await fetch(managedPlanApi,{headers:{Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`}});if(response.status===404){localStorage.removeItem(managedPlanKey);return null}const data=await response.json();if(!response.ok)throw new Error(data.detail||"Could not load workout plan.");localStorage.setItem(managedPlanKey,JSON.stringify(data));return data}catch{return JSON.parse(localStorage.getItem(managedPlanKey)||"null")}
}

function phaseSection(day,phase){
  const exercises=day.exercises.filter(item=>(item.phase||"Main")===phase);
  const cap=phaseCaps[managedExperience]?.[phase]??exercises.length;
  const label=phase==="Warm-up"?"warm-up":phase.toLowerCase();
  return `<section class="managed-phase phase-block-${phase.toLowerCase().replace("-","")}"><header><span>${phase}</span><b>${exercises.length}<small> / ${cap}</small></b></header><ol>${exercises.map(item=>`<li><div><strong>${managedPlanEscape(item.name)}</strong><small>${setsLabel(item.sets)} × ${managedPlanEscape(item.reps)} · ${item.rest_seconds}s rest</small></div><button type="button" data-plan-instructions="${managedPlanEscape(item.name)}">Instructions</button>${item.risk_note?`<p>${managedPlanEscape(item.risk_note)}</p>`:""}</li>`).join("")}</ol>${exercises.length<cap?`<button type="button" class="managed-add-exercise" data-add-day="${managedPlanEscape(day.day)}" data-add-phase="${phase}" aria-label="Add one ${label} exercise to ${managedPlanEscape(day.day)}">+1 ${label} exercise</button>`:`<p class="managed-phase-limit">${managedExperience} limit reached</p>`}</section>`;
}

function renderManagedPlan(view,plan){
  if(!plan){view.innerHTML="";view.hidden=true;const editor=document.querySelector(".plan-editor");if(editor)editor.hidden=false;return}
  const first=plan.days[0]?.exercises||[],count=phase=>first.filter(item=>(item.phase||"Main")===phase).length;
  view.innerHTML=`<header class="managed-plan-heading"><div><p class="eyebrow">YOUR SAVED PLAN TYPE</p><h2>${managedPlanEscape(plan.title)}</h2><span>${plan.days.length} training days · Day 1 has ${count("Warm-up")} warm-ups, ${count("Main")} main exercises and ${count("Finisher")} finishers.</span></div><div class="managed-plan-actions"><button type="button" class="managed-today-plan">Generate today’s plan</button><button type="button" class="managed-refresh-plan">New week, same type</button><button type="button" class="managed-new-plan">Change plan type</button><p class="managed-plan-notice" aria-live="polite"></p></div></header><div class="managed-plan-summary"><span><b>${plan.days.length}</b>Training days</span><span><b>${count("Warm-up")}</b>Warm-ups on day 1</span><span><b>${count("Main")}</b>Main on day 1</span><span><b>${count("Finisher")}</b>Finishers on day 1</span></div><section class="managed-week">${plan.days.map((day,index)=>`<details><summary><div><small>DAY ${index+1}</small><strong>${managedPlanEscape(day.day)}</strong></div><span class="managed-day-meta">${managedPlanEscape(day.focus)} · ${day.exercises.length} exercises</span><span class="managed-day-toggle" aria-hidden="true"></span></summary><div class="managed-day-content">${phaseSection(day,"Warm-up")}${phaseSection(day,"Main")}${phaseSection(day,"Finisher")}</div></details>`).join("")}</section>`;
  view.querySelector(".managed-new-plan").onclick=()=>{localStorage.setItem(managedPlanEditKey,"true");localStorage.setItem("setsaathi_active_view","plan");location.reload()};
  view.querySelector(".managed-refresh-plan").onclick=async event=>{const button=event.currentTarget,notice=view.querySelector(".managed-plan-notice");button.disabled=true;notice.textContent="Building a new week with your selected plan type…";try{const response=await fetch(`${API_BASE}/api/plans/regenerate`,{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`}}),data=await response.json();if(!response.ok)throw new Error(data.detail||"Could not refresh your weekly plan.");localStorage.setItem(managedPlanKey,JSON.stringify(data));renderManagedPlan(view,data)}catch(error){notice.textContent=error.message}finally{button.disabled=false}};
  view.querySelector(".managed-today-plan").onclick=async event=>{const button=event.currentTarget,notice=view.querySelector(".managed-plan-notice"),date=new Date(),dateKey=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;button.disabled=true;button.textContent="Generating…";try{const response=await fetch(`${API_BASE}/api/plans/today/from-current`,{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`}}),data=await response.json();if(!response.ok)throw new Error(data.detail||"Could not generate today’s plan.");localStorage.setItem(`setsaathi_today_plan_${dateKey}`,JSON.stringify(data));notice.textContent="Today’s plan is ready.";setTimeout(()=>document.querySelector(".app-tabs [data-view='progress']")?.click(),250)}catch(error){notice.textContent=error.message}finally{button.disabled=false;button.textContent="Generate today’s plan"}};
  view.onclick=async event=>{const add=event.target.closest("[data-add-day]");if(add){const day=add.dataset.addDay,phase=add.dataset.addPhase||"Main",notice=view.querySelector(".managed-plan-notice");add.disabled=true;add.textContent="Adding…";try{const response=await fetch(`${API_BASE}/api/plans/extra`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`},body:JSON.stringify({day,phase})}),data=await response.json();if(!response.ok)throw new Error(data.detail||"Could not add an exercise.");localStorage.setItem(managedPlanKey,JSON.stringify(data));const date=new Date(),dateKey=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;localStorage.removeItem(`setsaathi_today_plan_${dateKey}`);renderManagedPlan(view,data);view.querySelectorAll(".managed-week details").forEach(details=>{details.open=details.querySelector("summary strong")?.textContent===day});view.querySelector(".managed-plan-notice").textContent=`Added one ${phase.toLowerCase()} exercise to ${day}.`}catch(error){notice.textContent=error.message;add.disabled=false;add.textContent=`+1 ${phase.toLowerCase()} exercise`}return}const button=event.target.closest("[data-plan-instructions]");if(!button)return;window.openExerciseDetail?.(button.dataset.planInstructions)};
}

async function showManagedPlan(view){
  const editor=document.querySelector(".plan-editor");
  if(localStorage.getItem(managedPlanEditKey)==="true"){view.hidden=true;if(editor)editor.hidden=false;return}
  if(editor)editor.hidden=true;view.hidden=false;view.innerHTML="<div class='app-skeleton' role='status' aria-live='polite' aria-label='Loading your workout plan'><span></span><span></span><span></span></div>";renderManagedPlan(view,await fetchManagedPlan());
}

new MutationObserver(()=>{
  const tabs=document.querySelector(".app-tabs"),anchor=document.querySelector(".workout-log");if(!tabs||!anchor||document.querySelector(".workout-plan-view"))return;
  const view=document.createElement("section");view.className="workout-plan-view";view.hidden=true;anchor.after(view);
  fetchManagedPlan();
  if(localStorage.getItem("setsaathi_active_view")==="plan")setTimeout(()=>tabs.querySelector("[data-view='plan']")?.click(),0);
  const editor=document.querySelector(".plan-editor");editor?.addEventListener("submit",()=>setTimeout(async()=>{localStorage.removeItem(managedPlanEditKey);const plan=await fetchManagedPlan();renderManagedPlan(view,plan);view.hidden=false},700));
}).observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener("click",event=>{const tab=event.target.closest(".app-tabs button");if(!tab)return;const view=document.querySelector(".workout-plan-view"),editor=document.querySelector(".plan-editor");if(!view)return;if(tab.dataset.view==="plan")showManagedPlan(view);else{view.hidden=true;if(editor)editor.hidden=true}});

