import {loadWorkoutSets,renderSetEditor,setsFor} from "./workout-sets.js";
import {SKIP_ICON_SVG,setsLabel} from "./ui-utils.js";
import {API_BASE} from "./api-config.js";
const progressApi=`${API_BASE}/api/workout-progress`;
const progressAttendanceApi=`${API_BASE}/api/gym-attendance`;
const progressPlanKey="setsaathi_current_plan";
const progressTodayPlanApi=`${API_BASE}/api/plans/today`;
const progressCurrentPlanApi=`${API_BASE}/api/plans/current`;
const progressDayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
let progressRecords=[];

const progressDateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const progressEscape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const progressToken=()=>localStorage.getItem("setsaathi_token");

function progressPlanForToday(){
  const todayKey=progressDateKey(new Date()),daily=JSON.parse(localStorage.getItem(`setsaathi_today_plan_${todayKey}`)||"null");
  if(daily?.day)return {plan:{title:daily.title,rationale:daily.rationale,days:[daily.day]},day:daily.day,daily:true};
  const plan=JSON.parse(localStorage.getItem(progressPlanKey)||"null");
  if(!plan?.days?.length)return {plan:null,day:null};
  const today=new Date(),dayName=progressDayNames[today.getDay()];
  const day=plan.days.find(item=>item.day===dayName)||null;
  return {plan,day};
}

function recordFor(name,date=progressDateKey(new Date())){
  return progressRecords.find(item=>item.workout_date===date&&item.exercise_name===name);
}

function progressHistory(){
  const today=progressDateKey(new Date()),groups={};
  progressRecords.filter(item=>item.workout_date!==today&&item.status!=="pending").forEach(item=>(groups[item.workout_date]??=[]).push(item));
  const dates=Object.keys(groups).sort().reverse().slice(0,7);
  if(!dates.length)return `<p class="progress-empty">Your completed and skipped exercises will appear here after your first session.</p>`;
  return dates.map(date=>{const rows=groups[date],done=rows.filter(item=>item.status==="completed").length,skipped=rows.filter(item=>item.status==="skipped").length,logged=rows.reduce((count,item)=>count+setsFor(date,item.exercise_name).length,0);return `<article><time>${new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})}</time><strong>${done} completed</strong><span>${skipped} skipped · ${rows.length} recorded</span>${logged?`<small>${logged} set${logged===1?"":"s"} logged</small>`:""}</article>`}).join("");
}

function renderProgress(view){
  const {plan,day}=progressPlanForToday(),today=new Date(),date=progressDateKey(today);
  if(plan&&!day){view.innerHTML=`<section class="progress-empty-state"><div class="progress-empty-copy"><p class="eyebrow">TODAY'S WORKOUT</p><h2>Rest day.</h2><p>No workout is scheduled for ${progressEscape(today.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"}))}. You can review your saved plan or generate a session from Workout Plan.</p><button type="button" data-progress-action="plan">Open workout plan <span aria-hidden="true">↗</span></button></div></section>`;return}
  if(!plan||!day){view.innerHTML=`<section class="progress-empty-state"><div class="progress-empty-copy"><p class="eyebrow">YOUR TRAINING JOURNAL</p><h2>Every session starts somewhere.</h2><p>Choose a training plan to get your daily checklist. As you train, this page will show what you finished, skipped, and changed.</p><button type="button" data-progress-action="plan">Build my workout plan <span aria-hidden="true">↗</span></button></div><div class="progress-empty-preview" aria-label="How progress tracking works"><span class="progress-preview-label">HOW IT WORKS</span><div><b>01</b><span><strong>Choose a plan</strong><small>Set your training type and experience.</small></span></div><div><b>02</b><span><strong>Train today</strong><small>Follow the exercises planned for your session.</small></span></div><div><b>03</b><span><strong>See your progress</strong><small>Mark each exercise done, skipped, or changed.</small></span></div></div></section>`;return}
  const exercises=day.exercises||[],records=exercises.map(item=>recordFor(item.name,date)),completed=records.filter(item=>item?.status==="completed").length,skipped=records.filter(item=>item?.status==="skipped").length,changed=records.filter(item=>item?.status==="replaced").length,total=exercises.length,percent=total?Math.round(completed/total*100):0,resolved=completed+skipped;
  const cards=exercises.map((exercise,index)=>{const record=recordFor(exercise.name,date),status=record?.status||"pending",displayName=record?.replacement_name||exercise.name,statusText=status==="completed"?`Done${record?.replacement_name?` · ${record.replacement_name}`:""}`:status==="skipped"?"Skipped":status==="replaced"?`Changed to ${record.replacement_name}`:"Not started",suggestion=exercise.substitute||"Bodyweight alternative";return `<article class="progress-exercise status-${status}" data-exercise="${progressEscape(exercise.name)}"><div class="progress-exercise-number">${String(index+1).padStart(2,"0")}</div><div class="progress-exercise-copy"><div><h3>${progressEscape(displayName)}</h3>${record?.replacement_name?`<small>Originally ${progressEscape(exercise.name)}</small>`:""}</div><p>${setsLabel(exercise.sets)} × ${progressEscape(exercise.reps)} · ${exercise.rest_seconds}s rest</p><span class="progress-status">${progressEscape(statusText)}</span></div>${renderSetEditor(date,exercise.name,exercise.sets)}<div class="progress-exercise-actions"><button type="button" class="action-done" data-progress-action="done">✓ Mark done</button><button type="button" class="action-skip" data-progress-action="skip">${SKIP_ICON_SVG} Skip exercise</button><button type="button" class="action-change" data-progress-action="replace">⇄ Change</button>${status!=="pending"?`<button type="button" class="progress-undo" data-progress-action="undo">Undo last action</button>`:""}</div><section class="progress-change-panel" hidden><div><span>RECOMMENDED REPLACEMENT</span><strong>${progressEscape(suggestion)}</strong><small>Review this option before changing your exercise.</small></div><button type="button" data-progress-action="use-suggestion" data-suggestion="${progressEscape(suggestion)}">Use this</button><button type="button" data-progress-action="choose-manual">Choose another</button></section><form class="progress-replace" hidden><label>Choose your replacement<input maxlength="120" placeholder="Type an exercise name" value="${progressEscape(record?.replacement_name||suggestion)}" required></label><button type="submit">Save replacement</button><button type="button" data-progress-action="cancel-replace">Cancel</button></form></article>`}).join("");
  view.innerHTML=`<header class="progress-heading"><div><p class="eyebrow">TODAY'S PROGRESS</p><h2>${progressEscape(day.focus)}</h2><span>${today.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span></div><div class="progress-score"><strong>${completed}/${total}</strong><span>${percent}% complete</span></div></header><section class="progress-overview"><div class="progress-bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Workout completion"><i style="width:${percent}%"></i></div><div class="progress-stats"><span><b>${completed}</b>Completed</span><span><b>${total-resolved}</b>Remaining</span><span><b>${skipped}</b>Skipped</span><span><b>${changed}</b>Changed</span></div><div class="progress-overview-footer">${total>0&&resolved===total?'<button type="button" class="progress-finish" data-progress-action="finish">Finish workout</button>':`<span class="progress-next-step">${total-resolved} exercise${total-resolved===1?"":"s"} left to review</span>`}<p class="progress-notice" aria-live="polite"></p></div></section><section class="progress-list"><div class="progress-section-title"><div><p class="eyebrow">TODAY'S EXERCISES</p><h3>${total} movements planned</h3></div><span>Complete or skip every exercise to finish the workout.</span></div>${cards}</section><section class="progress-history"><div class="progress-section-title"><div><p class="eyebrow">RECENT SESSIONS</p><h3>Workout history</h3></div></div><div class="progress-history-grid">${progressHistory()}</div></section>`;
  view.querySelectorAll(".progress-exercise").forEach(card=>{
    const status=card.classList.contains("status-completed")?"done":card.classList.contains("status-skipped")?"skip":card.classList.contains("status-replaced")?"replace":null;
    const labels={done:"✓ Done",skip:SKIP_ICON_SVG+" Skip",replace:"⇄ Change",instructions:"ⓘ Info",undo:"Undo"};
    card.querySelectorAll(".progress-exercise-actions [data-progress-action]").forEach(button=>{
      const action=button.dataset.progressAction;
      if(labels[action])button.innerHTML=labels[action];
      const verb={done:"Mark done",skip:"Skip",replace:"Change",undo:"Undo last action for"}[action];
      if(verb)button.setAttribute("aria-label",`${verb} ${card.dataset.exercise}`);
      if(["done","skip"].includes(action))button.setAttribute("aria-pressed",String(action===status));
      if(action==="replace")button.setAttribute("aria-expanded","false");
    });
    const utilities=document.createElement("div");
    utilities.className="progress-exercise-utilities";
    const setLog=card.querySelector(".set-log");
    if(setLog)utilities.append(setLog);
    const undo=card.querySelector(".progress-undo");
    if(undo)card.append(undo);
    card.append(utilities);
  });
}

async function loadProgress(view){view.innerHTML='<div class="progress-skeleton" role="status" aria-live="polite" aria-label="Loading your progress"><span></span><span></span><span></span></div>';
  const end=new Date(),start=new Date();start.setDate(end.getDate()-30);
  try{const headers={Authorization:`Bearer ${progressToken()}`},todayKey=progressDateKey(end),[response,dailyResponse,currentResponse]=await Promise.all([fetch(`${progressApi}?start=${progressDateKey(start)}&end=${todayKey}`,{headers}),fetch(`${progressTodayPlanApi}?workout_date=${todayKey}`,{headers}),fetch(progressCurrentPlanApi,{headers})]),data=await response.json();if(!response.ok)throw new Error(data.detail||"Could not load progress.");if(dailyResponse.ok)localStorage.setItem(`setsaathi_today_plan_${todayKey}`,JSON.stringify(await dailyResponse.json()));else if(dailyResponse.status===404)localStorage.removeItem(`setsaathi_today_plan_${todayKey}`);if(currentResponse.ok)localStorage.setItem(progressPlanKey,JSON.stringify(await currentResponse.json()));else if(currentResponse.status===404)localStorage.removeItem(progressPlanKey);progressRecords=data;await loadWorkoutSets(progressDateKey(start),todayKey).catch(()=>[]);renderProgress(view)}catch(error){view.innerHTML=`<p class="progress-empty">${progressEscape(error.message)}</p>`}
}

async function saveProgress(view,exerciseName,status,replacementName=null){
  const {day}=progressPlanForToday(),date=progressDateKey(new Date()),existing=recordFor(exerciseName,date),notice=view.querySelector(".progress-notice");
  if(notice)notice.textContent="Saving…";
  try{const response=await fetch(progressApi,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${progressToken()}`},body:JSON.stringify({workout_date:date,workout_day:day.day,exercise_name:exerciseName,status,replacement_name:status==="pending"?null:replacementName??existing?.replacement_name??null,notes:""})}),data=await response.json();if(!response.ok)throw new Error(data.detail||"Could not save progress.");const index=progressRecords.findIndex(item=>item.id===data.id);if(index>=0)progressRecords[index]=data;else progressRecords.push(data);renderProgress(view);view.querySelector(".progress-notice").textContent=`${exerciseName}: ${status==="completed"?"done":status==="skipped"?"skipped":status==="replaced"?"changed":"reset"}.`;}catch(error){if(notice)notice.textContent=error.message}
}

async function finishWorkout(view){
  const date=progressDateKey(new Date()),notice=view.querySelector(".progress-notice"),button=view.querySelector(".progress-finish");button.disabled=true;notice.textContent="Saving workout…";
  try{const response=await fetch(progressAttendanceApi,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${progressToken()}`},body:JSON.stringify({workout_date:date,status:"completed"})}),data=await response.json();if(!response.ok)throw new Error(data.detail||"Could not finish workout.");notice.textContent="Workout completed — excellent work.";button.textContent="✓ Workout finished";window.dispatchEvent(new Event("attendance-updated"))}catch(error){notice.textContent=error.message;button.disabled=false}
}

function attachProgressEvents(view){
  view.onclick=event=>{const actionButton=event.target.closest("[data-progress-action]"),action=actionButton?.dataset.progressAction;if(!action)return;if(action==="plan"){document.querySelector(".app-tabs [data-view='plan']")?.click();return}const card=event.target.closest(".progress-exercise"),name=card?.dataset.exercise,panel=card?.querySelector(".progress-change-panel"),form=card?.querySelector(".progress-replace");if(action==="replace"){panel.hidden=!panel.hidden;form.hidden=true;actionButton.setAttribute("aria-expanded",String(!panel.hidden))}else if(action==="use-suggestion")saveProgress(view,name,"replaced",actionButton.dataset.suggestion);else if(action==="choose-manual"){panel.hidden=true;card.querySelector(".action-change")?.setAttribute("aria-expanded","false");form.hidden=false;form.querySelector("input").focus()}else if(action==="cancel-replace"){form.hidden=true;panel.hidden=true}else if(action==="done")saveProgress(view,name,"completed");else if(action==="skip")saveProgress(view,name,"skipped",null);else if(action==="undo")saveProgress(view,name,"pending",null);else if(action==="finish")finishWorkout(view);else if(action==="instructions"){window.openExerciseDetail?.(recordFor(name)?.replacement_name||name)}};
  view.onsubmit=event=>{const form=event.target.closest(".progress-replace");if(!form)return;event.preventDefault();const card=form.closest(".progress-exercise"),replacement=form.querySelector("input").value.trim();if(replacement)saveProgress(view,card.dataset.exercise,"replaced",replacement)};
}

new MutationObserver(()=>{
  const tabs=document.querySelector(".app-tabs"),anchor=document.querySelector(".exercise-library-view")||document.querySelector(".coach-view")||document.querySelector(".workout-log");
  if(!tabs||!anchor||document.querySelector(".progress-view"))return;
  const tab=[...tabs.querySelectorAll("button")].find(item=>item.textContent.trim()==="Today's Workout");if(!tab)return;tab.dataset.view="progress";
  const view=document.createElement("section");view.className="progress-view";view.hidden=true;anchor.after(view);attachProgressEvents(view);
}).observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener("click",event=>{const tab=event.target.closest(".app-tabs button");if(!tab)return;const view=document.querySelector(".progress-view");if(!view)return;view.hidden=tab.dataset.view!=="progress";if(tab.dataset.view==="progress")loadProgress(view)});
