(function(global){
  'use strict';
  const Repo = global.ProgressRepository;
  const DAY = 86400000;

  function daysSince(iso){ if(!iso)return 999; return Math.max(0,(Date.now()-new Date(iso).getTime())/DAY); }
  function isDue(record){ return !!record && (!record.dueAt || new Date(record.dueAt).getTime()<=Date.now()); }

  function questionPriority(user, question){
    const r=Repo.get(user,question);
    if(!r) return 1000+Math.random()*20;
    const accuracy=r.presentations?r.correct/r.presentations:0;
    let score=100;
    if(isDue(r)) score+=220;
    if(r.lastResult==='wrong') score+=160;
    if(r.status==='difficulty') score+=130;
    if(accuracy<.6) score+=80;
    if(r.presentations<3) score+=50;
    score+=Math.min(daysSince(r.lastSeen)*4,90);
    if(r.status==='mastered'&&!isDue(r)) score-=180;
    return score+Math.random()*12;
  }

  function conceptPriority(summary){
    let score=100;
    if(summary.status==='new') score+=260;
    if(summary.status==='difficulty') score+=240;
    if(summary.status==='practice') score+=100;
    if(summary.status==='mastered') score-=140;
    score+=(100-summary.coveragePct)*1.5;
    if(summary.presentations && summary.accuracy<70) score+=(70-summary.accuracy)*3;
    return score+Math.random()*10;
  }

  function select(user, questions, count){
    const eligible=questions.filter(q=>q&&q.activa!==false);
    if(!eligible.length) return [];
    const summaries=Repo.getConceptSummaries(user,eligible);
    const byKey=new Map(summaries.map(s=>[s.key,s]));
    const groups=new Map();
    eligible.forEach(q=>{
      const key=Repo.conceptKey(q);
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(q);
    });

    const ranked=[...groups.entries()].map(([key,items])=>({
      key,
      summary:byKey.get(key),
      score:conceptPriority(byKey.get(key)),
      items:items.slice().sort((a,b)=>questionPriority(user,b)-questionPriority(user,a))
    })).sort((a,b)=>b.score-a.score);

    const chosen=[];
    // Rondas por concepto: primero diversidad curricular, después repetimos los conceptos prioritarios.
    while(chosen.length<count){
      let added=false;
      for(const group of ranked){
        const q=group.items.shift();
        if(!q) continue;
        chosen.push(q); added=true;
        if(chosen.length>=count) break;
      }
      if(!added) break;
      ranked.sort((a,b)=>(b.score-b.items.length*.01)-(a.score-a.items.length*.01));
    }
    return chosen.slice(0,Math.min(count,eligible.length)).map(q=>({...q,attempts:0}));
  }

  global.QuestionSelector={select,priority:questionPriority,questionPriority,conceptPriority,isDue};
})(window);
