(function(global){
  'use strict';

  const Storage = global.AprendaliaStorage;
  const MAX_SESSIONS = 200;
  const DAY = 86400000;

  function hashText(text){
    let h = 2166136261;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function questionKey(question){
    return [question.asignatura || '', question.id || '', hashText(`${question.tipo || ''}|${question.pregunta || ''}|${question.respuesta || ''}`)].join('::');
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
    const old = all[key] || {
      key, id: question.id || '', subject: question.asignatura || '', type: question.tipo || '', question: question.pregunta || '',
      presentations:0, attempts:0, correct:0, wrong:0, firstTryCorrect:0, secondTryCorrect:0, recovered:0,
      assisted:0, hintsUsed:0, dontKnow:0, recentResults:[], lastSeen:null, lastResult:null, totalDurationMs:0,
      successStreak:0, intervalDays:0, dueAt:null
    };

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

  function saveSession(user, session){
    const sessions = Storage.get(sessionStorageKey(user), []);
    sessions.unshift(session);
    Storage.set(sessionStorageKey(user), sessions.slice(0, MAX_SESSIONS));
  }

  function getSessions(user, subject = null){
    const sessions = Storage.get(sessionStorageKey(user), []);
    return subject ? sessions.filter(s => s.subject === subject) : sessions;
  }

  function getSubjectSummary(user, subject, questions){
    const all = getAll(user);
    const subjectQuestions = questions.filter(q => q.asignatura === subject);
    const rows = subjectQuestions.map(q => {
      const record = all[questionKey(q)] || null;
      return { question:q, record, status:classify(record) };
    });
    const counts = { new:0, practice:0, difficulty:0, mastered:0 };
    rows.forEach(r => counts[r.status]++);
    const seen = rows.length - counts.new;
    return { total:rows.length, seen, coveragePct:rows.length ? Math.round(seen*100/rows.length):0, counts, rows };
  }

  function exportUserData(user){
    return {
      schemaVersion: Storage.VERSION,
      exportedAt: new Date().toISOString(),
      user,
      progress: getAll(user),
      sessions: getSessions(user)
    };
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
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  global.ProgressRepository = {
    questionKey, getAll, get, classify, recordOutcome, saveSession, getSessions, getSubjectSummary,
    exportUserData, importUserData, downloadUserData
  };
})(window);
