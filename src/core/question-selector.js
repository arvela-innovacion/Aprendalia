(function(global){
  'use strict';
  const Repo = global.ProgressRepository;
  const DAY = 86400000;

  function daysSince(iso){
    if (!iso) return 999;
    return Math.max(0, (Date.now() - new Date(iso).getTime()) / DAY);
  }
  function isDue(record){ return !!record && (!record.dueAt || new Date(record.dueAt).getTime() <= Date.now()); }

  function priority(user, question){
    const r = Repo.get(user, question);
    if (!r) return 1000 + Math.random()*20;
    const accuracy = r.presentations ? r.correct/r.presentations : 0;
    let score = 100;
    if (isDue(r)) score += 220;
    if (r.lastResult === 'wrong') score += 160;
    if (r.status === 'difficulty') score += 130;
    if (accuracy < .6) score += 80;
    if (r.presentations < 3) score += 50;
    score += Math.min(daysSince(r.lastSeen)*4, 90);
    if (r.status === 'mastered' && !isDue(r)) score -= 180;
    return score + Math.random()*12;
  }

  function takeRanked(arr, n, user){
    return arr.map(q=>({q,score:priority(user,q)})).sort((a,b)=>b.score-a.score).slice(0,n).map(x=>x.q);
  }

  function select(user, questions, count){
    const unseen=[], dueDifficulty=[], dueReview=[], other=[];
    questions.forEach(q=>{
      const r=Repo.get(user,q);
      if(!r) unseen.push(q);
      else if(isDue(r) && (r.status==='difficulty' || r.lastResult==='wrong')) dueDifficulty.push(q);
      else if(isDue(r)) dueReview.push(q);
      else other.push(q);
    });

    const chosen=[];
    const add=(items,n)=>{ takeRanked(items,n,user).forEach(q=>{ if(!chosen.includes(q)) chosen.push(q); }); };
    // Mientras haya contenido sin ver, reservamos al menos la mitad de la sesión para cobertura.
    const unseenSlots = unseen.length ? Math.max(1, Math.ceil(count * .5)) : 0;
    const difficultySlots = Math.min(Math.floor(count * .3), dueDifficulty.length);
    add(unseen, unseenSlots);
    add(dueDifficulty, difficultySlots);
    add(dueReview, Math.max(0, count - chosen.length));
    if(chosen.length < count) add(dueDifficulty, count - chosen.length);
    if(chosen.length < count) add(unseen, count - chosen.length);
    if(chosen.length < count) add(other, count - chosen.length);

    return chosen.slice(0,Math.min(count,questions.length)).map(q=>({...q,attempts:0}));
  }

  global.QuestionSelector = { select, priority, isDue };
})(window);
