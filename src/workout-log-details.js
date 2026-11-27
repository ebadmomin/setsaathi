import {SKIP_ICON_SVG} from "./ui-utils.js";
import {API_BASE} from "./api-config.js";
import {loadWorkoutSets, renderSetEditor} from "./workout-sets.js";
const detailedLogProgressApi=`${API_BASE}/api/workout-progress`;
const detailedLogAttendanceApi=`${API_BASE}/api/gym-attendance`;
const detailedLogTodayPlanApi=`${API_BASE}/api/plans/today`;
const detailedLogDate=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const detailedLogEscape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));

async function enhanceWorkoutLog(){
  const log=document.querySelector(".workout-log:not([hidden])"),cards=log?.querySelectorAll(".log-grid > article");
  if(!log||cards?.length!==3||cards[0].querySelector(".log-day-date")||log.dataset.enhancing==="true")return;
  log.dataset.enhancing="true";
  const selected=localStorage.getItem("setsaathi_log_date"),base=selected?new Date(`${selected}T12:00:00`):new Date(),dates=[-1,0,1].map(offset=>{const value=new Date(base);value.setDate(base.getDate()+offset);return value}),start=detailedLogDate(dates[0]),end=detailedLogDate(dates[2]),headers={Authorization:`Bearer ${localStorage.getItem("setsaathi_token")}`};
  try{
    const [progressResponse,attendanceResponse,dailyResponses]=await Promise.all([
      fetch(`${detailedLogProgressApi}?start=${start}&end=${end}`,{headers}),
      fetch(`${detailedLogAttendanceApi}?start=${start}&end=${end}`,{headers}),
      Promise.all(dates.map(value=>fetch(`${detailedLogTodayPlanApi}?workout_date=${detailedLogDate(value)}`,{headers}))),
      loadWorkoutSets(start,end).catch(()=>[]),
    ]),progress=await progressResponse.json(),attendance=await attendanceResponse.json();
    if(!progressResponse.ok||!attendanceResponse.ok)return;
    const dailyPlans=await Promise.all(dailyResponses.map(async response=>response.ok?response.json():null)),attendanceByDate=Object.fromEntries(attendance.map(item=>[item.workout_date,item.status]));
    cards.forEach((card,index)=>{
      card.classList.add("log-day-card",["log-day-previous","log-day-selected","log-day-next"][index]);
      const dateKey=detailedLogDate(dates[index]),daily=dailyPlans[index];
      if(daily?.day){
        card.querySelector(".log-rest-message")?.remove();
        card.querySelector("h3").textContent=`${daily.day.day} · ${daily.day.focus}`;
        const list=card.querySelector("ul");
        list.innerHTML=daily.day.exercises.map(exercise=>`<li>${detailedLogEscape(exercise.name)}<small>${exercise.sets} × ${detailedLogEscape(exercise.reps)} · ${detailedLogEscape(exercise.phase||"Main")}</small></li>`).join("");
        const marker=document.createElement("b");marker.className="daily-plan-marker";marker.textContent="Generated daily plan";card.querySelector("h3").after(marker);
      } else if(card.querySelector("h3")?.textContent.includes("Checking session")) {
        card.querySelector("h3").textContent=`${dates[index].toLocaleDateString("en-US",{weekday:"long"})} · Rest day`;
        const rest=card.querySelector(".log-rest-message");if(rest)rest.textContent="No workout planned. Take a rest day or generate a session for this date.";
      }
      const records=progress.filter(item=>item.workout_date===dateKey),byName=new Map(records.map(item=>[item.exercise_name,item])),done=records.filter(item=>item.status==="completed").length,skipped=records.filter(item=>item.status==="skipped").length,dateLabel=document.createElement("time");
      dateLabel.className="log-day-date";dateLabel.textContent=dates[index].toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"short"});card.querySelector("p")?.after(dateLabel);
      card.querySelectorAll("li").forEach(item=>{item.classList.remove("actual-completed","actual-skipped","actual-replaced");item.querySelector(".actual-status")?.remove();item.querySelector(".actual-sets")?.remove();item.querySelector(".set-log")?.remove();const name=item.childNodes[0]?.textContent?.trim(),record=byName.get(name);if(record){item.classList.add(`actual-${record.status}`);const badge=document.createElement("em");badge.className="actual-status";if(record.status==="skipped"){badge.innerHTML=SKIP_ICON_SVG;badge.append(" Skipped")}else{badge.textContent=record.status==="completed"?"✓ Done":record.status==="replaced"?`Changed: ${record.replacement_name}`:"Not started"}item.append(badge)}const exercise=daily?.day?.exercises.find(value=>value.name===name);if(exercise){const holder=document.createElement("div");holder.innerHTML=renderSetEditor(dateKey,name,exercise.sets);item.querySelector("small")?.before(holder.firstElementChild)}});
      const summary=document.createElement("div");summary.className="log-actual-summary";const attendanceStatus=attendanceByDate[dateKey]||"not-recorded",planned=card.querySelectorAll("li").length,attendanceLabel={completed:"Gym done",skipped:"Gym skipped",rest:"Rest day","not-recorded":"Not recorded"}[attendanceStatus]||"Not recorded";summary.innerHTML=`<span>${planned?`<b>${done}</b> of ${planned} exercises done${skipped?` · <b>${skipped}</b> skipped`:""}`:"No exercises planned"}</span><strong class="attendance-${attendanceStatus}">${attendanceLabel}</strong>`;(card.querySelector(".daily-plan-marker")||card.querySelector("h3")).after(summary);
    });
  }catch{}finally{cards.forEach((card,index)=>{if(card.querySelector("h3")?.textContent.includes("Checking session")){card.querySelector("h3").textContent=`${dates[index].toLocaleDateString("en-US",{weekday:"long"})} · Rest day`;const rest=card.querySelector(".log-rest-message");if(rest)rest.textContent="No workout planned. Take a rest day or generate a session for this date."}});log.dataset.enhancing="false"}
}

new MutationObserver(enhanceWorkoutLog).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
window.addEventListener("attendance-updated",()=>{const log=document.querySelector(".workout-log");log?.querySelectorAll(".log-day-date,.log-actual-summary,.daily-plan-marker").forEach(item=>item.remove());enhanceWorkoutLog()});
window.addEventListener("workout-sets-updated",()=>{const log=document.querySelector(".workout-log");log?.querySelectorAll(".log-day-date,.log-actual-summary,.daily-plan-marker").forEach(item=>item.remove());enhanceWorkoutLog()});
