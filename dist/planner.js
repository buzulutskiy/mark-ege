'use strict';
// Pure planning functions: never change completed work or external appointments.
(()=>{
const DAY=86400000,stamp=s=>Date.parse(s+'T12:00:00Z'),distance=(a,b)=>Math.round((stamp(b)-stamp(a))/DAY),dateAdd=(s,n)=>new Date(stamp(s)+n*DAY).toISOString().slice(0,10),maxDate=(...d)=>d.sort().at(-1),clone=x=>JSON.parse(JSON.stringify(x));
const defaults={deadline:'2027-05-31',weeklyCap:720,dailyCap:150,recoveryDays:7};
function settings(state){return {...defaults,...state.strategy?.planning?.settings}}
function effective(cp,state){let o=state.strategy?.planning?.schedule?.[cp.id];return o?{...cp,...o,originalStart:cp.start,originalEnd:cp.end}:cp}
function taskSignature(tasks){return JSON.stringify(tasks.map(t=>[t.id,t.date,t.minutes,t.teacher,t.actual,t.done,t.subject,t.suggestedTopic||null]).sort((a,b)=>a[0].localeCompare(b[0])))}
function makePlan(source,id,now,checkpoints,completed=[]){
 const next=clone(source),strategy=next.strategy||{},oldPlanning=strategy.planning||{},cfg=settings(next),index=checkpoints.findIndex(c=>c.id===id);if(index<0)throw Error('Неизвестная цель');
 const cp=effective(checkpoints[index],next),from=maxDate(now,cp.start,'2026-09-14'),remaining=checkpoints.slice(index).filter(c=>!completed.includes(c.id)||c.id===id),oldFinal=effective(checkpoints.at(-1),next).end;
 const requiredSpan=remaining.slice(1).reduce((s,c)=>s+(c.kind==='month'?7:2),0),latestEnd=dateAdd(cfg.deadline,-requiredSpan),desiredEnd=dateAdd(maxDate(now,cp.end),cfg.recoveryDays),newEnd=desiredEnd>latestEnd?latestEnd:desiredEnd;
 if(dateAdd(from,cfg.recoveryDays-1)>newEnd||cfg.deadline<newEnd||distance(newEnd,cfg.deadline)<requiredSpan)return {ok:false,reason:'На повторение и оставшиеся проверки не хватает календарных дней до выбранной даты. Нужен пересмотр приоритетов с преподавателем или изменение рамок; сроки не были сдвинуты за дедлайн.'};
 let schedule={...oldPlanning.schedule},previousEnd=newEnd,oldRange=Math.max(1,distance(cp.end,oldFinal)),newRange=distance(newEnd,cfg.deadline);
 for(let i=0;i<remaining.length;i++){let original=remaining[i],current=effective(original,next),minDays=i?(original.kind==='month'?7:2):0,tail=remaining.slice(i+1).reduce((s,c)=>s+(c.kind==='month'?7:2),0),end=i?dateAdd(newEnd,Math.round(Math.max(0,distance(cp.end,current.end))/oldRange*newRange)):newEnd;
  if(i)end=maxDate(end,dateAdd(previousEnd,minDays));let latest=dateAdd(cfg.deadline,-tail);if(end>latest)end=latest;
  const start=i&&original.kind==='month'?dateAdd(previousEnd,1):from;if(end<start)return {ok:false,reason:'Этапы нельзя разместить без наложения и потери времени на проверку.'};schedule[original.id]={start,end};previousEnd=end;
 }
 const known=new Set(next.weeks),generated=[];let serial=0;const prefix='plan-'+now+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),newId=()=>prefix+'-'+(++serial);
 const template=[[0,'math',50,false],[0,'physics',50,false],[1,'ru',45,false],[1,'math',60,true],[2,'math',50,false],[2,'physics',50,false],[3,'ru',45,false],[3,'physics',75,true],[4,'math',50,false],[4,'physics',50,false],[5,'physics',45,false]];
 let startWeek=monday(from);for(let w=startWeek;w<=cfg.deadline;w=dateAdd(w,7)){if(known.has(w))continue;for(let [d,subject,minutes,teacher]of template){let date=dateAdd(w,d);if(date<from||date>cfg.deadline)continue;const t={id:newId(),date,subject,minutes,teacher,title:teacher?'С преподавателем':'Самостоятельно',done:false,actual:0};next.tasks.push(t);generated.push(t.id)}known.add(w)}
 const movable=t=>!t.teacher&&!t.done&&!t.actual&&(t.date>=from||t.date<now&&t.date>='2026-09-14');let regular=next.tasks.filter(movable).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),fixed=next.tasks.filter(t=>!movable(t));let recovery=[];
 for(let r=0;r<Math.ceil(cfg.recoveryDays/7);r++)for(let subject of ['ru','math','physics']){let t={id:newId(),date:from,subject,minutes:45,teacher:false,title:'Повторение',done:false,actual:0,recoveryFor:id};recovery.push(t);generated.push(t.id)}
 const dayUse={},weekUse={};const count=(date,minutes)=>{dayUse[date]=(dayUse[date]||0)+minutes;const w=monday(date);weekUse[w]=(weekUse[w]||0)+minutes};for(let t of fixed)count(t.date,Math.max(t.minutes,t.actual||0));
 if(Object.entries(dayUse).some(([d,n])=>d>=from&&d<=cfg.deadline&&n>cfg.dailyCap)||Object.entries(weekUse).some(([w,n])=>w>=monday(from)&&w<=cfg.deadline&&n>cfg.weeklyCap))return {ok:false,reason:'Уже закреплённые занятия превышают выбранный лимит. Сначала согласуйте расписание с преподавателем или измените лимит: фактические занятия не переносились.'};
 const fits=(date,t)=>new Date(stamp(date)).getUTCDay()!==0&&(dayUse[date]||0)+t.minutes<=cfg.dailyCap&&(weekUse[monday(date)]||0)+t.minutes<=cfg.weeklyCap;
 const allocate=(t,ideal)=>{for(let d=maxDate(from,ideal);d<=cfg.deadline;d=dateAdd(d,1))if(fits(d,t)){t.date=d;count(d,t.minutes);return true}for(let d=from;d<ideal&&d<=cfg.deadline;d=dateAdd(d,1))if(fits(d,t)){t.date=d;count(d,t.minutes);return true}return false};
 let failed=[];for(let t of recovery)if(!allocate(t,from))failed.push(t);
 const span=Math.max(1,distance(from,cfg.deadline)),delay=Math.min(cfg.recoveryDays,span);
 for(let t of regular){const pos=Math.max(0,Math.min(span,distance(from,t.date))),ideal=dateAdd(from,Math.min(span,Math.round(delay+pos*(span-delay)/span)));if(!allocate(t,ideal))failed.push(t)}
 if(failed.length)return {ok:false,reason:`Не помещаются ${failed.length} занятий (${failed.reduce((s,t)=>s+t.minutes,0)} мин) при лимите ${cfg.weeklyCap/60} ч в неделю и ${cfg.dailyCap} мин в день. План сохранён без переноса: обсудите приоритеты или измените лимиты.`,unplaced:failed.length};
 const originalById=new Map(source.tasks.map(t=>[t.id,t]));let moved=regular.filter(t=>originalById.has(t.id)&&originalById.get(t.id).date!==t.date).length;
 next.tasks=[...fixed,...regular,...recovery];next.weeks=[...known].sort();const changed={};for(let t of next.tasks){const old=originalById.get(t.id);if(old&&old.date!==t.date)changed[t.id]={before:old.date,after:t.date}};
 const maxWeekly=Math.max(0,...Object.entries(weekUse).filter(([w])=>w>=monday(from)&&w<=cfg.deadline).map(([,n])=>n)),compression=remaining.length>1?Math.round(Math.max(0,1-newRange/oldRange)*100):0,summary={id,at:now,from,deadline:cfg.deadline,newEnd,moved,generated:generated.length,recoveryMinutes:recovery.length*45,maxWeekly,compression};
 const previous={schedule:oldPlanning.schedule||{},feedback:oldPlanning.feedback||{},summary:oldPlanning.summary||null,issues:oldPlanning.issues||null,weeks:source.weeks,tasks:source.tasks};
 strategy.planning={...oldPlanning,settings:cfg,schedule,feedback:{...oldPlanning.feedback,[id]:{status:'struggling',at:now}},issues:null,summary,undo:{previous,changed,generated,signature:taskSignature(next.tasks)}};next.strategy=strategy;return {ok:true,state:next,summary};
}
function undo(source){let u=source.strategy?.planning?.undo;if(!u)return {ok:false,reason:'Нет пересчёта для отмены.'};if(taskSignature(source.tasks)!==u.signature)return {ok:false,reason:'После пересчёта занятия уже изменились. Чтобы сохранить новые отметки, автоматическая отмена недоступна.'};let next=clone(source),ids=new Set(u.generated);next.tasks=clone(u.previous.tasks);next.weeks=u.previous.weeks;let p=next.strategy.planning;Object.assign(p,{schedule:u.previous.schedule,feedback:u.previous.feedback,summary:u.previous.summary,issues:u.previous.issues,undo:null});return {ok:true,state:next}}
window.planEngine={settings,effective,makePlan,undo,taskSignature,defaults};
})();
window.validatePlanning=p=>{
 if(p===undefined)return true;if(!p||typeof p!=='object'||Array.isArray(p))return false;
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x),validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&iso(parse(s))===s&&s>='2026-01-01'&&s<='2028-12-31',ids=window.ROADMAP.checkpoints.map(c=>c.id),task=t=>object(t)&&typeof t.id==='string'&&/^[a-zA-Z0-9.-]{1,100}$/.test(t.id)&&Object.hasOwn(names,t.subject)&&validDate(t.date)&&typeof t.title==='string'&&Number.isInteger(t.minutes)&&t.minutes>0&&t.minutes<=1440&&Number.isInteger(t.actual)&&t.actual>=0&&t.actual<=1440&&typeof t.done==='boolean'&&typeof t.teacher==='boolean';
 const cfg=window.planEngine.settings({strategy:{planning:p}});if(!validDate(cfg.deadline)||cfg.deadline<'2026-09-14'||cfg.deadline>'2027-08-31'||!Number.isInteger(cfg.weeklyCap)||cfg.weeklyCap<180||cfg.weeklyCap>1500||!Number.isInteger(cfg.dailyCap)||cfg.dailyCap<45||cfg.dailyCap>240||!Number.isInteger(cfg.recoveryDays)||cfg.recoveryDays<1||cfg.recoveryDays>21)return false;
 const schedule=s=>object(s)&&Object.entries(s).every(([id,v])=>ids.includes(id)&&object(v)&&validDate(v.start)&&validDate(v.end)&&v.start<=v.end),feedback=f=>object(f)&&Object.entries(f).every(([id,v])=>ids.includes(id)&&object(v)&&['struggling','ontrack'].includes(v.status)&&validDate(v.at));
 if(p.schedule!==undefined&&!schedule(p.schedule)||p.feedback!==undefined&&!feedback(p.feedback))return false;
 if(p.issues!==undefined&&p.issues!==null&&(typeof p.issues!=='string'||p.issues.length>2000))return false;
 if(p.lastFailed!==undefined&&!ids.includes(p.lastFailed))return false;
 const summary=s=>object(s)&&ids.includes(s.id)&&['at','from','deadline','newEnd'].every(k=>validDate(s[k]))&&['moved','generated','recoveryMinutes','maxWeekly','compression'].every(k=>Number.isFinite(s[k])&&s[k]>=0);
 if(p.summary!==undefined&&p.summary!==null&&!summary(p.summary))return false;
 if(p.undo!==undefined&&p.undo!==null){const u=p.undo;if(!object(u)||!object(u.previous)||typeof u.signature!=='string'||u.signature.length>500000||!Array.isArray(u.generated)||!u.generated.every(x=>typeof x==='string')||!Array.isArray(u.previous.tasks)||!u.previous.tasks.every(task)||!Array.isArray(u.previous.weeks)||!u.previous.weeks.every(validDate)||!schedule(u.previous.schedule)||!feedback(u.previous.feedback))return false}
 return true;
};
