(function(global){
  'use strict';

  const Storage = global.AprendaliaStorage;
  const MAX_SESSIONS = 200;
  const DAY = 86400000;

  function questionKey(question){
    return String(question?.id || '').trim();
  }
  function conceptKey(question){
    return [question?.curso||'',question?.asignatura||'',question?.tema||'',question?.concepto||''].join('::');
  }
  function progressStorageKey(user){ return `progress:${user || 'anon'}`; }
  function sessionStorageKey(user){ return `sessions:${user || 'anon'}`; }
  function getAll(user){ return Storage.get(progressStorageKey(user), {}); }
  function get(user, question){ return getAll(user)[questionKey(question)] || null; }

  function classify(record){
    if (!record || !record.presentations) return 'new';
    const accuracy = record.presentations ? record.correct / record.presentations : 0;
    const recent = Array.isArray(record.recentResults) ? record.recentResults.slice(-4) : [];
    const recentFails = recent.filter(x => x === 'wrong').length;
    if (recentFails >= 2 || (record.presentations >= 2 && accuracy < 0.6)) return 'difficulty';
    if (record.presentations >= 3 && accuracy >= 0.8 && (record.successStreak || 0) >= 2) return 'mastered';
    return 'practice';
  }

  function intervalFor(outcome, previous){
    if (outcome.result !== 'correct') return { streak:0, days:1 };
    const streak = (previous.successStreak || 0) + 1;
    if (outcome.assisted || outcome.attempts > 1 || outcome.recovered) {
      return { streak: Math.min(streak, 2), days: outcome.recovered ? 2 : 1 };
    }
    const steps = [1, 3, 7, 14, 30, 60];
    return { streak, days: steps[Math.min(streak - 1, steps.length - 1)] };
  }

  function recordOutcome(user, question, outcome){
    const all = getAll(user);
    const key = questionKey(question);
    if (!key) throw new Error('No se puede guardar progreso de una pregunta sin ID estable');
    const old = all[key] || {
      key,
      id: question.id || '', course:question.curso||'', subject:question.asignatura||'', topic:question.tema||'', concept:question.concepto||'', level:Number(question.nivel||0),
      type: question.tipo || '', question: question.pregunta || '',
      presentations:0, attempts:0, correct:0, wrong:0, firstTryCorrect:0, secondTryCorrect:0, recovered:0,
      assisted:0, hintsUsed:0, dontKnow:0, recentResults:[], lastSeen:null, lastResult:null, totalDurationMs:0,
      successStreak:0, intervalDays:0, dueAt:null
    };

    // Los metadatos curriculares se refrescan por si se corrige el texto/etiquetado sin cambiar el ID.
    Object.assign(old, {
      id:question.id||old.id, course:question.curso||old.course, subject:question.asignatura||old.subject,
      topic:question.tema||old.topic, concept:question.concepto||old.concept, level:Number(question.nivel||old.level||0),
      type:question.tipo||old.type, question:question.pregunta||old.question
    });

    old.presentations += 1;
    old.attempts += Math.max(1, Number(outcome.attempts || 1));
    old.lastSeen = outcome.endedAt || new Date().toISOString();
    old.lastResult = outcome.result;
    old.totalDurationMs += Math.max(0, Number(outcome.durationMs || 0));
    if (outcome.assisted) old.assisted += 1;
    if (outcome.hintUsed) old.hintsUsed += 1;
    if (outcome.dontKnow) old.dontKnow += 1;

    if (outcome.result === 'correct') {
      old.correct += 1;
      if (outcome.recovered) old.recovered += 1;
      else if (outcome.attempts === 1 && !outcome.assisted) old.firstTryCorrect += 1;
      else old.secondTryCorrect += 1;
      old.recentResults.push('correct');
    } else {
      old.wrong += 1;
      old.recentResults.push('wrong');
    }

    const schedule = intervalFor(outcome, old);
    old.successStreak = schedule.streak;
    old.intervalDays = schedule.days;
    old.dueAt = new Date(new Date(old.lastSeen).getTime() + schedule.days * DAY).toISOString();
    old.recentResults = old.recentResults.slice(-6);
    old.status = classify(old);
    all[key] = old;
    Storage.set(progressStorageKey(user), all);
    return old;
  }

  function aggregateConcept(user, conceptQuestions){
    const all=getAll(user);
    const records=conceptQuestions.map(q=>all[questionKey(q)]||null).filter(Boolean);
    const presentations=records.reduce((n,r)=>n+(r.presentations||0),0);
    const correct=records.reduce((n,r)=>n+(r.correct||0),0);
    const wrong=records.reduce((n,r)=>n+(r.wrong||0),0);
    const seenQuestions=records.length;
    const totalQuestions=conceptQuestions.length;
    const accuracy=presentations ? Math.round(correct*100/presentations) : 0;
    const levelsSeen=[...new Set(records.map(r=>Number(r.level||0)).filter(Boolean))].sort((a,b)=>a-b);
    const questionStatuses=records.map(classify);
    let status='new';
    if(presentations){
      const difficultyCount=questionStatuses.filter(x=>x==='difficulty').length;
      if(difficultyCount>=2 || (presentations>=4 && accuracy<60)) status='difficulty';
      else if(seenQuestions>=Math.min(5,totalQuestions) && accuracy>=80 && questionStatuses.filter(x=>x==='mastered').length>=2) status='mastered';
      else status='practice';
    }
    return {presentations,correct,wrong,seenQuestions,totalQuestions,coveragePct:totalQuestions?Math.round(seenQuestions*100/totalQuestions):0,accuracy,levelsSeen,status};
  }

  function getConceptSummaries(user, questions){
    const groups=new Map();
    questions.filter(q=>q?.activa!==false).forEach(q=>{
      const key=conceptKey(q);
      if(!groups.has(key)) groups.set(key,{key,course:q.curso,subject:q.asignatura,topic:q.tema,concept:q.concepto,questions:[]});
      groups.get(key).questions.push(q);
    });
    return [...groups.values()].map(g=>({...g,...aggregateConcept(user,g.questions)}));
  }

  function saveSession(user, session){
    const sessions = Storage.get(sessionStorageKey(user), []);
    sessions.unshift(session);
    Storage.set(sessionStorageKey(user), sessions.slice(0, MAX_SESSIONS));
  }

  function getSessions(user, subject = null, course = null){
    let sessions = Storage.get(sessionStorageKey(user), []);
    if(course) sessions=sessions.filter(s=>s.course===course || !s.course);
    return subject ? sessions.filter(s => s.subject === subject) : sessions;
  }

  function getSubjectSummary(user, subject, questions, course=null){
    const all = getAll(user);
    const subjectQuestions = questions.filter(q => q.asignatura === subject && (!course || q.curso===course) && q.activa!==false);
    const rows = subjectQuestions.map(q => {
      const record = all[questionKey(q)] || null;
      return { question:q, record, status:classify(record) };
    });
    const counts = { new:0, practice:0, difficulty:0, mastered:0 };
    rows.forEach(r => counts[r.status]++);
    const seen = rows.length - counts.new;
    const concepts=getConceptSummaries(user,subjectQuestions);
    const conceptCounts={new:0,practice:0,difficulty:0,mastered:0};
    concepts.forEach(c=>conceptCounts[c.status]++);
    return { total:rows.length, seen, coveragePct:rows.length ? Math.round(seen*100/rows.length):0, counts, rows, concepts, conceptCounts };
  }

  function getCourseSummary(user, course, questions){
    const courseQuestions=questions.filter(q=>q.curso===course && q.activa!==false);
    const all=getAll(user);
    const seen=courseQuestions.filter(q=>all[questionKey(q)]).length;
    const concepts=getConceptSummaries(user,courseQuestions);
    return {
      course,totalQuestions:courseQuestions.length,seenQuestions:seen,
      coveragePct:courseQuestions.length?Math.round(seen*100/courseQuestions.length):0,
      totalConcepts:concepts.length,
      masteredConcepts:concepts.filter(c=>c.status==='mastered').length,
      difficultyConcepts:concepts.filter(c=>c.status==='difficulty').length,
      concepts
    };
  }

  function exportUserData(user){
    return { schemaVersion:Storage.VERSION, exportedAt:new Date().toISOString(), user, progress:getAll(user), sessions:getSessions(user) };
  }
  function importUserData(user, payload){
    if (!payload || typeof payload !== 'object') throw new Error('Archivo no válido');
    if (!payload.progress || !Array.isArray(payload.sessions)) throw new Error('La copia no contiene progreso válido');
    Storage.set(progressStorageKey(user), payload.progress);
    Storage.set(sessionStorageKey(user), payload.sessions.slice(0, MAX_SESSIONS));
    return true;
  }
  function downloadUserData(user){
    const blob = new Blob([JSON.stringify(exportUserData(user), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aprendalia-progreso-${user || 'alumno'}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  global.ProgressRepository = {
    questionKey,conceptKey,getAll,get,classify,recordOutcome,getConceptSummaries,
    saveSession,getSessions,getSubjectSummary,getCourseSummary,exportUserData,importUserData,downloadUserData
  };
})(window);
