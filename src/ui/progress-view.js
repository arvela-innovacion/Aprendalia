(function(global){
  'use strict';
  const labels={new:'Sin ver',practice:'En práctica',difficulty:'Con dificultad',mastered:'Dominado'};
  const icons={new:'⚪',practice:'🟡',difficulty:'🔴',mastered:'🟢'};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pct=r=>!r||!r.presentations?'—':`${Math.round(r.correct*100/r.presentations)}%`;
  const shortDate=iso=>{if(!iso)return'—';try{return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short'}).format(new Date(iso));}catch(_){return'—';}};

  function weeklyStats(sessions){
    const cutoff=Date.now()-7*86400000;
    const week=sessions.filter(s=>new Date(s.endedAt||0).getTime()>=cutoff);
    const total=week.reduce((n,s)=>n+(s.total||0),0),correct=week.reduce((n,s)=>n+(s.correct||0),0);
    return {sessions:week.length,total,correct,accuracy:total?Math.round(correct*100/total):0,stars:week.reduce((n,s)=>n+(s.stars||0),0)};
  }

  function conceptMeta(c){
    const q=c.questions?.[0]||{curso:c.course,asignatura:c.subject,tema:c.topic,concepto:c.concept};
    const C=global.AprendaliaCurriculum;
    return {topic:C?.labelTopic(q)||c.topic,concept:C?.labelConcept(q)||c.concept};
  }

  function render(container,user,subject,questions,options={}){
    const repo=global.ProgressRepository;
    const course=options.course||global.AprendaliaAccess?.getStudentProfile?.(user)?.course||'';
    const courseQuestions=questions.filter(q=>!course||q.curso===course);
    const summary=repo.getSubjectSummary(user,subject,courseQuestions,course);
    const courseSummary=repo.getCourseSummary(user,course,courseQuestions);
    const sessions=repo.getSessions(user,subject,course);
    const week=weeklyStats(sessions);
    const practiced=summary.rows.filter(x=>x.record).sort((a,b)=>new Date(b.record.lastSeen||0)-new Date(a.record.lastSeen||0));
    const conceptNeeds=summary.concepts.filter(c=>c.status==='difficulty').sort((a,b)=>a.accuracy-b.accuracy).slice(0,6);
    const recent=sessions.slice(0,8);
    const trend=recent.slice().reverse().map(s=>{const p=s.total?Math.round((s.correct||0)*100/s.total):0;return`<div class="trend-col" title="${p}%"><span style="height:${Math.max(8,p)}%"></span><small>${p}%</small></div>`;}).join('');
    const C=global.AprendaliaCurriculum;
    const courseLabel=C?.labelCourse(course)||course;
    const subjectLabel=C?.labelSubject(course,subject)||subject;

    const conceptRows=summary.concepts.slice().sort((a,b)=>{
      const ma=conceptMeta(a),mb=conceptMeta(b);return `${ma.topic}-${ma.concept}`.localeCompare(`${mb.topic}-${mb.concept}`,'es');
    }).map(c=>{
      const m=conceptMeta(c); const levels=c.levelsSeen.length?c.levelsSeen.join(', '):'—';
      return `<tr data-concept-status="${c.status}"><td><strong>${esc(m.topic)}</strong><br><span>${esc(m.concept)}</span></td><td>${levels}</td><td>${c.seenQuestions}/${c.totalQuestions}</td><td>${c.presentations?c.accuracy+'%':'—'}</td><td>${icons[c.status]} ${labels[c.status]}</td></tr>`;
    }).join('');

    container.innerHTML=`
      <div class="progress-panel-head">
        <div><span class="setup-kicker">${esc(subjectLabel)}</span><h2>Resumen para padres</h2><div class="parent-identity"><span>👤 ${esc(user)}</span><span>🎓 ${esc(courseLabel)}</span><span>📘 ${esc(subjectLabel)}</span></div></div>
        <div class="backup-actions"><button id="exportProgressBtn" class="ghost-btn small-btn" type="button">Exportar copia</button><button id="importProgressBtn" class="ghost-btn small-btn" type="button">Importar copia</button><input id="importProgressFile" type="file" accept="application/json" hidden></div>
      </div>
      <div class="parent-summary-grid">
        <article><span>Esta semana</span><strong>${week.sessions}</strong><small>sesiones</small></article>
        <article><span>Acierto semanal</span><strong>${week.accuracy}%</strong><small>${week.correct}/${week.total||0} respuestas</small></article>
        <article><span>Cobertura asignatura</span><strong>${summary.coveragePct}%</strong><small>${summary.seen}/${summary.total} preguntas</small></article>
        <article><span>Conceptos a reforzar</span><strong>${summary.conceptCounts.difficulty}</strong><small>de ${summary.concepts.length} conceptos</small></article>
      </div>
      <div class="course-overview"><strong>${esc(courseLabel)}</strong><span>${courseSummary.masteredConcepts}/${courseSummary.totalConcepts} conceptos dominados</span><span>${courseSummary.coveragePct}% de preguntas vistas</span></div>
      <div class="mastery-grid">
        <div><strong>🟢 ${summary.conceptCounts.mastered}</strong><span>Conceptos dominados</span></div>
        <div><strong>🟡 ${summary.conceptCounts.practice}</strong><span>En práctica</span></div>
        <div><strong>🔴 ${summary.conceptCounts.difficulty}</strong><span>Con dificultad</span></div>
        <div><strong>⚪ ${summary.conceptCounts.new}</strong><span>Sin empezar</span></div>
      </div>
      <section class="parent-section"><div class="section-title"><h3>Conceptos que necesitan repaso</h3><span>Prioridad actual</span></div>
        ${conceptNeeds.length?`<div class="needs-review">${conceptNeeds.map(c=>{const m=conceptMeta(c);return`<article><div><span class="question-id">${esc(m.topic)}</span><strong>${esc(m.concept)}</strong></div><span>🔴 ${c.accuracy}% · ${c.seenQuestions}/${c.totalQuestions} vistas</span></article>`;}).join('')}</div>`:'<p class="empty-copy">No hay conceptos marcados con dificultad ahora mismo.</p>'}
      </section>
      <section class="parent-section progress-table-wrap"><div class="section-title"><h3>Mapa curricular de la asignatura</h3><span>Tema · concepto · nivel</span></div>
        ${conceptRows?`<table class="progress-table curriculum-table"><thead><tr><th>Tema / concepto</th><th>Niveles vistos</th><th>Cobertura</th><th>Acierto</th><th>Estado</th></tr></thead><tbody>${conceptRows}</tbody></table>`:'<p class="empty-copy">No hay conceptos definidos para esta asignatura.</p>'}
      </section>
      <section class="parent-section"><div class="section-title"><h3>Evolución reciente</h3><span>Últimas ${recent.length} sesiones</span></div><div class="trend-bars">${trend||'<p class="empty-copy">Todavía no hay sesiones guardadas.</p>'}</div></section>
      <section class="parent-section"><div class="section-title"><h3>Últimas sesiones</h3></div><div class="recent-sessions">${recent.length?recent.map(s=>`<div class="recent-session"><span>${shortDate(s.endedAt)}</span><strong>${s.correct}/${s.total}</strong><span>⭐ ${s.stars}</span></div>`).join(''):'<p class="empty-copy">Todavía no hay sesiones guardadas.</p>'}</div></section>
      <section class="progress-table-wrap parent-section"><div class="section-title"><h3>Preguntas practicadas</h3><div class="status-filters"><button data-status="all" class="filter-chip active">Todas</button><button data-status="difficulty" class="filter-chip">Con dificultad</button><button data-status="practice" class="filter-chip">En práctica</button><button data-status="mastered" class="filter-chip">Dominadas</button></div></div>
        ${practiced.length?`<table class="progress-table"><thead><tr><th>Concepto / pregunta</th><th>Nivel</th><th>Veces</th><th>Acierto</th><th>Estado</th><th>Próximo repaso</th></tr></thead><tbody>${practiced.map(({question,record,status})=>`<tr data-progress-status="${status}"><td><span class="question-id">${esc(C?.labelTopic(question)||question.tema)} · ${esc(C?.labelConcept(question)||question.concepto)} · ${esc(question.id)}</span>${esc(question.pregunta)}</td><td>${esc(question.nivel)}</td><td>${record.presentations}</td><td>${pct(record)}</td><td>${icons[status]} ${labels[status]}</td><td>${record.dueAt?shortDate(record.dueAt):'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="empty-copy">Aún no hay preguntas practicadas en esta asignatura.</p>'}
      </section>`;

    container.querySelectorAll('.filter-chip').forEach(btn=>btn.addEventListener('click',()=>{
      container.querySelectorAll('.filter-chip').forEach(b=>b.classList.toggle('active',b===btn));
      const status=btn.dataset.status;
      container.querySelectorAll('[data-progress-status]').forEach(row=>{row.style.display=status==='all'||row.dataset.progressStatus===status?'':'none';});
    }));
    container.querySelector('#exportProgressBtn')?.addEventListener('click',()=>repo.downloadUserData(user));
    const file=container.querySelector('#importProgressFile');
    container.querySelector('#importProgressBtn')?.addEventListener('click',()=>file?.click());
    file?.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;try{repo.importUserData(user,JSON.parse(await f.text()));render(container,user,subject,questions,options);}catch(err){alert('No se pudo importar la copia: '+err.message);}});
  }
  global.ProgressView={render};
})(window);
