(function(global){
  'use strict';
  const labels={new:'Sin ver',practice:'En práctica',difficulty:'Con dificultad',mastered:'Dominada'};
  const icons={new:'⚪',practice:'🟡',difficulty:'🔴',mastered:'🟢'};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pct=r=>!r||!r.presentations?'—':`${Math.round(r.correct*100/r.presentations)}%`;
  const shortDate=iso=>{ if(!iso)return'—'; try{return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short'}).format(new Date(iso));}catch(_){return'—';} };

  function weeklyStats(sessions){
    const cutoff=Date.now()-7*86400000;
    const week=sessions.filter(s=>new Date(s.endedAt||0).getTime()>=cutoff);
    const total=week.reduce((n,s)=>n+(s.total||0),0), correct=week.reduce((n,s)=>n+(s.correct||0),0);
    return {sessions:week.length,total,correct,accuracy:total?Math.round(correct*100/total):0,stars:week.reduce((n,s)=>n+(s.stars||0),0)};
  }

  function render(container,user,subject,questions){
    const repo=global.ProgressRepository;
    const summary=repo.getSubjectSummary(user,subject,questions);
    const sessions=repo.getSessions(user,subject);
    const week=weeklyStats(sessions);
    const practiced=summary.rows.filter(x=>x.record).sort((a,b)=>new Date(b.record.lastSeen||0)-new Date(a.record.lastSeen||0));
    const needs=summary.rows.filter(x=>x.status==='difficulty'||(x.record&&global.QuestionSelector?.isDue(x.record)&&x.record.lastResult==='wrong')).slice(0,8);
    const recent=sessions.slice(0,8);
    const trend=recent.slice().reverse().map(s=>{ const p=s.total?Math.round((s.correct||0)*100/s.total):0; return `<div class="trend-col" title="${p}%"><span style="height:${Math.max(8,p)}%"></span><small>${p}%</small></div>`; }).join('');

    container.innerHTML=`
      <div class="progress-panel-head">
        <div><span class="setup-kicker">${esc(subject)}</span><h2>Resumen para padres</h2></div>
        <div class="backup-actions"><button id="exportProgressBtn" class="ghost-btn small-btn" type="button">Exportar copia</button><button id="importProgressBtn" class="ghost-btn small-btn" type="button">Importar copia</button><input id="importProgressFile" type="file" accept="application/json" hidden></div>
      </div>
      <div class="parent-summary-grid">
        <article><span>Esta semana</span><strong>${week.sessions}</strong><small>sesiones</small></article>
        <article><span>Acierto semanal</span><strong>${week.accuracy}%</strong><small>${week.correct}/${week.total||0} respuestas</small></article>
        <article><span>Cobertura</span><strong>${summary.coveragePct}%</strong><small>${summary.seen}/${summary.total} preguntas</small></article>
        <article><span>Necesitan repaso</span><strong>${summary.counts.difficulty}</strong><small>preguntas con dificultad</small></article>
      </div>
      <div class="mastery-grid">
        <div><strong>🟢 ${summary.counts.mastered}</strong><span>Dominadas</span></div>
        <div><strong>🟡 ${summary.counts.practice}</strong><span>En práctica</span></div>
        <div><strong>🔴 ${summary.counts.difficulty}</strong><span>Con dificultad</span></div>
        <div><strong>⚪ ${summary.counts.new}</strong><span>Sin ver</span></div>
      </div>
      <section class="parent-section"><div class="section-title"><h3>Necesita repasar</h3><span>Prioridad actual</span></div>
        ${needs.length?`<div class="needs-review">${needs.map(({question,record,status})=>`<article><div><span class="question-id">${esc(question.id)}</span><strong>${esc(question.pregunta)}</strong></div><span>${icons[status]} ${labels[status]} · ${pct(record)}</span></article>`).join('')}</div>`:'<p class="empty-copy">No hay preguntas marcadas con dificultad ahora mismo.</p>'}
      </section>
      <section class="parent-section"><div class="section-title"><h3>Evolución reciente</h3><span>Últimas ${recent.length} sesiones</span></div><div class="trend-bars">${trend||'<p class="empty-copy">Todavía no hay sesiones guardadas.</p>'}</div></section>
      <section class="parent-section"><div class="section-title"><h3>Últimas sesiones</h3></div><div class="recent-sessions">${recent.length?recent.map(s=>`<div class="recent-session"><span>${shortDate(s.endedAt)}</span><strong>${s.correct}/${s.total}</strong><span>⭐ ${s.stars}</span></div>`).join(''):'<p class="empty-copy">Todavía no hay sesiones guardadas.</p>'}</div></section>
      <section class="progress-table-wrap parent-section"><div class="section-title"><h3>Preguntas practicadas</h3><div class="status-filters"><button data-status="all" class="filter-chip active">Todas</button><button data-status="difficulty" class="filter-chip">Con dificultad</button><button data-status="practice" class="filter-chip">En práctica</button><button data-status="mastered" class="filter-chip">Dominadas</button></div></div>
        ${practiced.length?`<table class="progress-table"><thead><tr><th>Pregunta</th><th>Veces</th><th>Acierto</th><th>Estado</th><th>Próximo repaso</th></tr></thead><tbody>${practiced.map(({question,record,status})=>`<tr data-progress-status="${status}"><td><span class="question-id">${esc(question.id)}</span>${esc(question.pregunta)}</td><td>${record.presentations}</td><td>${pct(record)}</td><td>${icons[status]} ${labels[status]}</td><td>${record.dueAt?shortDate(record.dueAt):'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="empty-copy">Aún no hay preguntas practicadas en esta asignatura.</p>'}
      </section>`;

    container.querySelectorAll('.filter-chip').forEach(btn=>btn.addEventListener('click',()=>{
      container.querySelectorAll('.filter-chip').forEach(b=>b.classList.toggle('active',b===btn));
      const status=btn.dataset.status;
      container.querySelectorAll('[data-progress-status]').forEach(row=>{ row.style.display=status==='all'||row.dataset.progressStatus===status?'':'none'; });
    }));
    container.querySelector('#exportProgressBtn')?.addEventListener('click',()=>repo.downloadUserData(user));
    const file=container.querySelector('#importProgressFile');
    container.querySelector('#importProgressBtn')?.addEventListener('click',()=>file?.click());
    file?.addEventListener('change',async()=>{
      const f=file.files?.[0]; if(!f)return;
      try{ repo.importUserData(user,JSON.parse(await f.text())); render(container,user,subject,questions); }
      catch(err){ alert('No se pudo importar la copia: '+err.message); }
    });
  }
  global.ProgressView={render};
})(window);
