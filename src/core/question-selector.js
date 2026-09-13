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

  function selectAdaptive(user, eligible, count){
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
    return chosen;
  }

  function selectReview(user, eligible, count){
    const seen=eligible.filter(q=>Repo.get(user,q));
    if(!seen.length) return selectAdaptive(user,eligible,count);
    const preferred=seen.filter(q=>{
      const r=Repo.get(user,q);
      return isDue(r) || r?.status==='difficulty' || r?.lastResult==='wrong' || r?.status==='practice';
    });
    const pool=(preferred.length ? preferred : seen).slice().sort((a,b)=>questionPriority(user,b)-questionPriority(user,a));
    const chosen=[];
    for(const q of pool){ if(chosen.length<count) chosen.push(q); }
    if(chosen.length<count){
      const rest=seen.filter(q=>!chosen.includes(q)).sort((a,b)=>questionPriority(user,b)-questionPriority(user,a));
      for(const q of rest){ if(chosen.length<count) chosen.push(q); }
    }
    return chosen;
  }

  function selectDiscover(user, eligible, count){
    const unseen=eligible.filter(q=>!Repo.get(user,q));
    const chosen=selectAdaptive(user,unseen,count);
    if(chosen.length>=count) return chosen;
    const rest=eligible.filter(q=>!chosen.includes(q));
    return chosen.concat(selectAdaptive(user,rest,count-chosen.length));
  }

  function select(user, questions, count, options={}){
    const eligible=questions.filter(q=>q&&q.activa!==false);
    if(!eligible.length) return [];
    const mode=options.mode||'adaptive';
    let chosen;
    if(mode==='review') chosen=selectReview(user,eligible,count);
    else if(mode==='discover') chosen=selectDiscover(user,eligible,count);
    else chosen=selectAdaptive(user,eligible,count);
    return chosen.slice(0,Math.min(count,eligible.length)).map(q=>({...q,attempts:0}));
  }

  global.QuestionSelector={select,priority:questionPriority,questionPriority,conceptPriority,isDue};
})(window);
