function activePlanExercises(){
  const date=new Date(),dateKey=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`,daily=JSON.parse(localStorage.getItem(`setsaathi_today_plan_${dateKey}`)||"null");
  if(daily?.day?.exercises)return daily.day.exercises;
  const plan=JSON.parse(localStorage.getItem("setsaathi_current_plan")||"null");
  if(!plan?.days?.length)return [];
  const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],today=new Date(),day=plan.days.find(item=>item.day===days[today.getDay()])||plan.days[(today.getDay()+6)%plan.days.length];
  return day?.exercises||[];
}

function addPlanPhaseLabels(){
  const exercises=activePlanExercises();
  if(!exercises.length)return;
  const byName=new Map(exercises.map(item=>[item.name,item]));
  document.querySelectorAll(".progress-exercise").forEach(card=>{
    const exercise=byName.get(card.dataset.exercise),heading=card.querySelector(".progress-exercise-copy h3");
    if(!exercise||!heading||card.querySelector(".phase-badge"))return;
    const badge=document.createElement("span");badge.className=`phase-badge phase-${(exercise.phase||"Main").toLowerCase().replace("-","")}`;badge.textContent=exercise.phase||"Main";heading.before(badge);
  });
  document.querySelectorAll(".today-exercise").forEach(card=>{
    const name=card.querySelector(":scope > b")?.textContent,exercise=byName.get(name);
    if(!exercise||card.querySelector(".phase-badge"))return;
    const badge=document.createElement("span");badge.className=`phase-badge phase-${(exercise.phase||"Main").toLowerCase().replace("-","")}`;badge.textContent=exercise.phase||"Main";card.prepend(badge);
  });
  const title=document.querySelector(".progress-list .progress-section-title");
  if(title&&!title.querySelector(".phase-breakdown")){
    const counts={"Warm-up":0,"Main":0,"Finisher":0};exercises.forEach(item=>counts[item.phase||"Main"]++);
    const summary=document.createElement("div");summary.className="phase-breakdown";summary.innerHTML=`<b>${counts["Warm-up"]} warm-ups</b><b>${counts.Main} main</b><b>${counts.Finisher} finishers</b>`;title.append(summary);
  }
}

new MutationObserver(addPlanPhaseLabels).observe(document.documentElement,{childList:true,subtree:true});
