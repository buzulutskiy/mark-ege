'use strict';
(()=>{
const stages=()=>window.ROADMAP.checkpoints.filter(c=>!c.id.startsWith('week'));
const days=(a,b)=>Math.round((parse(b)-parse(a))/86400000);
function effective(cp,s,k){const old=window.planEngine.effective(cp,s),v=s.strategy?.subjectPlans?.[k]?.schedule?.[cp.id];return v?{...old,...v}:old}
function assign(source,k,now){const s=JSON.parse(JSON.stringify(source)),cp=stages(),plan=s.strategy?.subjectPlans?.[k];const list=window.TOPICS.filter(t=>t.subject===k).sort((a,b)=>{const ar=window.topicEngine.record(s,a.id),br=window.topicEngine.record(s,b.id);return Number(br.status==='struggling')-Number(ar.status==='struggling')||Number(window.topicEngine.known(s,a.id))-Number(window.topicEngine.known(s,b.id))||a.period.localeCompare(b.period)||Number(a.code)-Number(b.code)});let i=0;for(const t of s.tasks.filter(t=>t.subject===k&&!t.teacher&&!t.done&&!t.actual&&t.date>=now).sort((a,b)=>a.date.localeCompare(b.date))){const eligible=list.filter(x=>effective(cp.find(c=>c.id===x.period),s,k).start<=t.date);const pool=eligible.length?eligible:list;t.suggestedTopic=pool[i++%pool.length].id}return s}
function apply(source,k,id,answer,now,onlyRecorded=false){let s=JSON.parse(JSON.stringify(source)),all=stages(),index=all.findIndex(c=>c.id===id);if(index<0||!Object.hasOwn(names,k))return {ok:false,reason:'Неизвестный этап'};s.strategy={...s.strategy,subjectPlans:{...s.strategy?.subjectPlans}};const old=s.strategy.subjectPlans[k]||{},p={...old,schedule:{...old.schedule},feedback:{...old.feedback,[id]:{status:answer,at:now}},issue:null};s.strategy.subjectPlans[k]=p;const current=effective(all[index],source,k),deadline=window.planEngine.settings(source).deadline;
 if(answer==='ontrack'){
 s.strategy.topics={...s.strategy.topics};for(const t of window.TOPICS.filter(t=>t.subject===k&&t.period===id))if(window.topicEngine.record(s,t.id).status!=='reviewed')s.strategy.topics[t.id]={status:'known',at:now};
 p.schedule[id]={start:current.start<now?current.start:now,end:now};let end=now;
 for(const cp of all.slice(index+1)){const prev=effective(cp,source,k);if(p.feedback[cp.id]?.status==='ontrack')continue;const start=shift(end,1)<START_WEEK?START_WEEK:shift(end,1),duration=Math.max(7,days(prev.start,prev.end)+1);end=shift(start,duration-1);if(end>prev.end)end=prev.end;if(end<start)end=start;if(end>deadline){p.issue='Следующие этапы не помещаются до даты готовности.';break}p.schedule[cp.id]={start,end}}
 }else{
 if(!onlyRecorded){s.strategy.topics={...s.strategy.topics};for(const t of window.TOPICS.filter(t=>t.subject===k&&t.period===id))s.strategy.topics[t.id]={status:'struggling',at:now}}
 if(old.feedback?.[id]?.status==='struggling'&&!old.issue)return {ok:true,state:assign(s,k,now)};
 const remaining=all.slice(index+1).filter(c=>p.feedback[c.id]?.status!=='ontrack'),from=current.start>now?current.start:now,desired=shift(current.end>now?current.end:now,window.planEngine.settings(source).recoveryDays),latest=shift(deadline,-7*remaining.length),end=desired<latest?desired:latest;
 if(end<from){p.issue='До даты готовности не хватает времени на повторение. Обсудите приоритеты с преподавателем; сроки не изменены.';return {ok:false,state:s,reason:p.issue}}
 p.schedule[id]={start:from,end};let previous=end;const span=Math.max(1,days(current.end,deadline)),available=days(end,deadline);
 remaining.forEach((cp,i)=>{const orig=effective(cp,source,k),start=shift(previous,1),proposed=shift(end,Math.round(Math.max(0,days(current.end,orig.end))/span*available)),min=shift(start,6),max=shift(deadline,-7*(remaining.length-i-1));let next=proposed<min?min:proposed;if(next>max)next=max;p.schedule[cp.id]={start,end:next};previous=next});
 }
 return {ok:true,state:assign(s,k,now)}
}
function update(k,id,answer,onlyRecorded=false){if(window.markCloud?.active&&!window.markCloud.writable)return;const out=apply(state,k,id,answer,today,onlyRecorded);if(out.state){state=out.state;save();render()}toast(out.ok?(answer==='ontrack'?'Цель предмета закрыта. Следующий этап можно начать раньше.':'План предмета обновлён. Остальные предметы не изменились.'):out.reason)}
function controls(cp,k){const p=state.strategy?.subjectPlans?.[k],v=p?.feedback?.[cp.id],c=effective(cp,state,k);return `<p class="subject-deadline">${fmt(c.start)} — ${fmt(c.end)}${v?.status==='ontrack'?' · ✓ Цель закрыта по отметке':v?.status==='struggling'?' · Нужно повторить':''}</p><div class="feedbackbuttons"><button data-subject-goal="${cp.id}" data-subject="${k}" data-answer="ontrack" data-roadmap-write>Получается · закрыть цель</button><button data-subject-goal="${cp.id}" data-subject="${k}" data-answer="struggling" data-roadmap-write>Не получается</button></div>${p?.issue?`<p class="muted">${escape(p.issue)}</p>`:''}`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-subject-goal]');if(b)update(b.dataset.subject,b.dataset.subjectGoal,b.dataset.answer)});
window.subjectFlow={effective,apply,assign,update,controls};
window.validateSubjectPlans=p=>p===undefined||!!p&&typeof p==='object'&&!Array.isArray(p)&&Object.entries(p).every(([k,v])=>Object.hasOwn(names,k)&&v&&window.validatePlanning({schedule:v.schedule||{},feedback:v.feedback||{},issues:v.issue}));
window.renderRoadmap?.();
})();
