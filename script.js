const MAX_ATTEMPTS = 2;
const SESSION_SIZE = 10; // meta fija de preguntas por sesión
let questions=[], queue=[], current, score=0;
let sessionStats = null;
let questionLocked = false;
let answerSubmitting = false;
let subjectSelected='';
let preguntaActual = null;
let usuarioActual = null;
let cursoActual = null;
let curriculumLoaded = false;

function trackActivity(eventName, extra = {}) {
  AprendaliaTelemetry?.send?.(eventName, {
    alumno: usuarioActual || extra.alumno || '',
    deviceKey: getDeviceKey(),
    deviceInfo: getDeviceLabel(),
    asignatura: extra.asignatura ?? subjectSelected ?? '',
    ...extra
  });
}

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ===================================== BOTONES Y ACIERTOS CENTRALIZADO ============================================== */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

// Estado de sesión y recompensas. El rendimiento académico se guarda separado de las estrellas.
function createSessionStats(total = 0) {
  return SessionEngine.create(total);
}

function storageKey() {
  return `aprendalia:stars:${usuarioActual || 'anon'}`;
}

function getTotalStars() {
  try {
    const value = Number(localStorage.getItem(storageKey()));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (_) {
    return 0;
  }
}

function addPersistentStars(amount) {
  if (!amount || amount < 1) return;
  try {
    localStorage.setItem(storageKey(), String(getTotalStars() + amount));
  } catch (_) {
    // La sesión sigue funcionando aunque el navegador bloquee almacenamiento local.
  }
}

function updateSessionHud() {
  if (!sessionStats) return;
  score = sessionStats.stars; // compatibilidad con el código histórico
  const scoreEl = document.getElementById('score');
  const streakEl = document.getElementById('streak');
  const progressEl = document.getElementById('progress');
  if (scoreEl) scoreEl.innerText = sessionStats.stars;
  if (streakEl) {
    streakEl.innerText = sessionStats.streak;
    streakEl.parentElement?.classList.toggle('is-hot', sessionStats.streak >= 3);
  }
  const shown = Math.min(sessionStats.presented, sessionStats.totalPlanned);
  if (progressEl) progressEl.innerText = `${shown}/${sessionStats.totalPlanned}`;
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = `${sessionStats.totalPlanned ? (shown / sessionStats.totalPlanned) * 100 : 0}%`;
}

function breakStreak() {
  ScoringEngine.breakStreak(sessionStats);
  updateSessionHud();
}

function recordCurrentOutcome(result, points = 0) {
  if (!current || current._outcomeRecorded) return;
  const endedAt = new Date().toISOString();
  const attempts = Math.max(1, (current.attempts || 0) + (result === 'correct' ? 1 : 0));
  const outcome = {
    key: ProgressRepository.questionKey(current),
    id: current.id,
    question: current.pregunta,
    type: current.tipo,
    result,
    attempts,
    recovered: (current.reviewCount || 0) > 0 && result === 'correct',
    assisted: !!(current.usedHint || current.usedDontKnow || current.usedSelfAssessment),
    hintUsed: !!current.usedHint,
    dontKnow: !!current.usedDontKnow,
    selfAssessment: !!current.usedSelfAssessment,
    stars: points,
    startedAt: current._startedAt || endedAt,
    endedAt,
    durationMs: Math.max(0, Date.now() - (current._startedAtMs || Date.now()))
  };
  ProgressRepository.recordOutcome(usuarioActual, current, outcome);
  sessionStats?.outcomes.push(outcome);
  current._outcomeRecorded = true;
}

function saveCurrentSession() {
  if (!sessionStats || sessionStats.saved) return;
  ProgressRepository.saveSession(usuarioActual, SessionEngine.toHistory(sessionStats, subjectSelected, cursoActual));
  sessionStats.saved = true;
}

// Registra un fallo y decide si se han agotado los intentos de esta presentación.
// Si se agotan, la pregunta se repite una única vez más adelante para reforzarla.
function handleIncorrect() {
  if (!current) return false;
  if (typeof current.attempts !== 'number') current.attempts = 0;
  current.attempts += 1;
  breakStreak();

  const exhausted = current.attempts >= MAX_ATTEMPTS;
  if (exhausted && (current.reviewCount || 0) < 1 && sessionStats?.presented < sessionStats?.totalPlanned) {
    const review = { ...current, attempts: 0, reviewCount: (current.reviewCount || 0) + 1 };
    if (queue.length >= (sessionStats.totalPlanned - sessionStats.presented)) queue.pop();
    queue.push(review);
  }
  return exhausted;
}

// Deshabilitar todos los controles de respuesta (opciones, botón comprobar, input)
function disableAnswerControls(){
  document.querySelectorAll('#answers button, #answers [role="option"], #answers div[role="listitem"]').forEach(el=>{
    try{ el.disabled = true; }catch(e){}
    el.setAttribute && el.setAttribute('aria-disabled','true');
    el.classList && el.classList.add('disabled');
  });
  const check = document.getElementById('checkBtn');
  if(check) { check.disabled = true; check.setAttribute('aria-disabled','true'); check.classList.add('disabled'); }
  const write = document.getElementById('writeAnswer');
  if(write) { write.disabled = true; write.setAttribute('aria-disabled','true'); write.classList.add('disabled'); }
}

function enableAnswerControls(){
  document.querySelectorAll('#answers button, #answers [role="option"], #answers div[role="listitem"]').forEach(el=>{
    try{ el.disabled = false; }catch(e){}
    el.setAttribute && el.setAttribute('aria-disabled','false');
    el.classList && el.classList.remove('disabled');
  });
  const check = document.getElementById('checkBtn');
  if(check) { check.disabled = false; check.setAttribute('aria-disabled','false'); check.classList.remove('disabled'); }
  const write = document.getElementById('writeAnswer');
  if(write) { write.disabled = false; write.setAttribute('aria-disabled','false'); write.classList.remove('disabled'); }
}

function awardCorrectResult() {
  const reward = ScoringEngine.awardCorrect(sessionStats, current);
  if (reward.points > 0) addPersistentStars(reward.points);
  updateSessionHud();
  return reward;
}

function markAnswerProcessing(targetBtn = null) {
  answerSubmitting = true;
  if (targetBtn?.classList) targetBtn.classList.add('is-processing');
  disableAnswerControls();
}

function releaseAnswerForRetry(targetBtn = null) {
  window.setTimeout(() => {
    if (questionLocked) return;
    answerSubmitting = false;
    if (targetBtn?.classList) targetBtn.classList.remove('is-processing');
    enableAnswerControls();

    // En respuestas escritas, devolver el foco ayuda a que el segundo intento sea inmediato.
    const write = document.getElementById('writeAnswer');
    if (write && write.style.display !== 'none') {
      write.focus();
      write.select?.();
    }
  }, 280);
}

function handleCorrect(targetBtn = null, showNext = true) {
  if (questionLocked || answerSubmitting) return;
  questionLocked = true;
  markAnswerProcessing(targetBtn);

  const reward = awardCorrectResult();
  recordCurrentOutcome('correct', reward.points);
  const f = document.getElementById('feedback');
  f.innerHTML = `<span class="feedback-title">${reward.label}</span><span class="feedback-reward">+${reward.points} ⭐</span>`;
  f.classList.remove('reward-pop');
  void f.offsetWidth;
  f.classList.add('reward-pop');
  registrarEvento("Acierto");
  visualAcierto(targetBtn);
  disableAnswerControls();
  animarPuntos();

  if (showNext) document.getElementById('next').style.display = 'inline-flex';
}

function handleError(targetBtn = null) {
  if (questionLocked || answerSubmitting) return;
  markAnswerProcessing(targetBtn);

  registrarEvento("Error");
  visualError(targetBtn);
  const exhausted = handleIncorrect();
  const f = document.getElementById('feedback');

  if (!exhausted) {
    document.querySelector('#game .question-card')?.classList.add('is-retry');
    f.innerHTML = '<span class="feedback-title">2.º intento · Casi 💪</span><span class="feedback-help">Mira de nuevo y prueba otra respuesta.</span>';
    releaseAnswerForRetry(targetBtn);
    return;
  }

  questionLocked = true;
  recordCurrentOutcome('wrong', 0);
  const isReview = (current?.reviewCount || 0) > 0;
  if (sessionStats && !isReview) sessionStats.failed += 1;
  f.innerHTML = isReview ? '<span class="feedback-title">Seguiremos practicándola 📚</span>' : '<span class="feedback-title">La volveremos a practicar 📚</span><span class="feedback-help">Equivocarse también ayuda a aprender.</span>';
  if (preguntaActual?.respuesta) {
    const solution = document.getElementById('solucion');
    solution.innerHTML = `<strong>La respuesta es:</strong> ${preguntaActual.respuesta}`;
    solution.style.display = 'block';
  }
  disableAnswerControls();
  document.getElementById('next').style.display = 'inline-flex';
}


function revealHint(){
  if (!current || current.usedHint) return;
  current.usedHint = true;
  breakStreak();
  const hintBtn = document.getElementById('hintBtn');
  if (hintBtn) { hintBtn.disabled = true; hintBtn.style.display = 'none'; }
  const f = document.getElementById('feedback');
  f.innerHTML = current.extra
    ? `<span class="feedback-title">💡 Pista</span><span class="feedback-help">${current.extra}</span>`
    : '<span class="feedback-title">💡 Piensa paso a paso</span><span class="feedback-help">Descarta primero las respuestas que sabes que no pueden ser.</span>';
}

function handleDontKnow(){
  if (!current || questionLocked || current.usedDontKnow) return;
  current.usedDontKnow = true;
  breakStreak();
  registrarEvento('No sabe');
  const btn = document.getElementById('dontKnowBtn');
  if (btn) { btn.disabled = true; btn.style.display = 'none'; }

  // Si ya había fallado una vez, "No lo sé" consume el segundo intento y mostramos la solución.
  if ((current.attempts || 0) >= 1) {
    handleError(null);
    return;
  }

  current.attempts = 1;
  const f = document.getElementById('feedback');
  f.innerHTML = current.extra
    ? `<span class="feedback-title">Está bien no saberlo todavía 🤔</span><span class="feedback-help">💡 ${current.extra}</span>`
    : '<span class="feedback-title">Está bien no saberlo todavía 🤔</span><span class="feedback-help">Prueba una respuesta; esta vez contará como intento con ayuda.</span>';
}

function renderSessionSummary() {
  const completedStats = sessionStats;
  if (completedStats && !completedStats.saved) {
    trackActivity('session_completed', {
      estado: `${completedStats.firstTry + completedStats.secondTry}/${completedStats.firstTry + completedStats.secondTry + completedStats.failed}`,
      durationMs: Math.max(0, Date.now() - new Date(completedStats.startedAt || Date.now()).getTime()),
      detalle: `stars=${completedStats.stars};best_streak=${completedStats.bestStreak}`
    });
  }
  saveCurrentSession();
  const q = document.getElementById('question');
  const a = document.getElementById('answers');
  const f = document.getElementById('feedback');
  const next = document.getElementById('next');
  const solution = document.getElementById('solucion');
  const aids = document.getElementById('learning-aids');
  if (aids) aids.style.display = 'none';
  const stats = sessionStats || createSessionStats();
  const answeredOriginals = stats.firstTry + stats.secondTry + stats.failed;
  const academicCorrect = stats.firstTry + stats.secondTry;
  const pct = answeredOriginals ? Math.round((academicCorrect / answeredOriginals) * 100) : 0;

  q.innerText = '🎉 ¡Sesión terminada!';
  f.innerText = pct >= 80 ? '¡Gran trabajo! Has avanzado un montón.' : 'Buen trabajo. Lo importante es seguir practicando.';
  solution.style.display = 'none';
  next.style.display = 'none';
  a.classList.remove('large');
  a.innerHTML = `
    <div class="session-summary">
      <div class="summary-hero">
        <div>Resultado de hoy</div>
        <div class="summary-stars">⭐ ${stats.stars} estrellas</div>
        <div>${academicCorrect}/${answeredOriginals} correctas · ${pct}%</div>
      </div>
      <div class="summary-grid">
        <div class="summary-stat"><strong>${stats.firstTry}</strong>A la primera</div>
        <div class="summary-stat"><strong>${stats.secondTry}</strong>Con ayuda / 2.º intento</div>
        <div class="summary-stat"><strong>${stats.recovered}</strong>Recuperadas</div>
        <div class="summary-stat"><strong>🔥 ${stats.bestStreak}</strong>Mejor racha</div>
      </div>
      <div class="summary-total">⭐ ${getTotalStars()} estrellas acumuladas</div>
      <div class="summary-actions">
        <button class="primary-btn" type="button" id="restartSessionBtn">Otra sesión</button>
        <button class="ghost-btn" type="button" id="changeSubjectBtn">Cambiar asignatura</button>
      </div>
    </div>`;
  a.querySelector('#restartSessionBtn')?.addEventListener('click', startGame);
  a.querySelector('#changeSubjectBtn')?.addEventListener('click', showSessionSetup);
  updateBrandHomeState();
  launchConfetti(null, 80);
}

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ================================================= INICIO DEL JUEGO ================================================= */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

function showDeviceAccessInfo(authResult){
  const box = document.getElementById('deviceAccessInfo');
  if (!box) return;
  if (!authResult || authResult.reason !== 'device') {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <strong>Este dispositivo todavía no está autorizado.</strong>
    <span>${escapeHtml(authResult.deviceLabel || 'Dispositivo')}</span>
    <code>${escapeHtml(authResult.deviceId)}</code>
    <small>Envía este código a quien administra Aprendalia para que lo vincule a tu usuario.</small>`;
}

function login(){
  const nameInput = document.getElementById('name').value;
  const name = AprendaliaAccess.normalizeUsername(nameInput);
  const password = document.getElementById('pass').value;

  subjectSelected = document.getElementById('subject').value || 'Lengua';
  showDeviceAccessInfo(null);

  if(!name || !password){
    alert('Introduce tu usuario y contraseña');
    return;
  }

  const auth = AprendaliaAccess.authenticateStudent(name, password, AprendaliaAccess.getDeviceId());
  if (auth.ok) {
    usuarioActual = auth.username;
    cursoActual = auth.course || AprendaliaAccess.getStudentProfile(auth.username)?.course || '';
    trackActivity('login_success');
    document.getElementById('pass').value = '';
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('welcome').setAttribute('aria-hidden', 'true');
    showSessionSetup();
  } else if (auth.reason === 'device') {
    usuarioActual = null;
    cursoActual = null;
    document.getElementById('pass').value = '';
    showDeviceAccessInfo(auth);
  } else {
    usuarioActual = null;
    cursoActual = null;
    alert('Usuario o contraseña incorrectos');
  }
}


const SUBJECT_UI = {
  Lengua: ['📚', 'Lengua'], Ingles: ['🇬🇧', 'Inglés'], Matematicas: ['➗', 'Matemáticas'], Socials: ['🌍', 'Socials']
};

async function ensureCurriculumLoaded(){
  if (curriculumLoaded) return AprendaliaCurriculum.current();
  const data = await AprendaliaCurriculum.load();
  curriculumLoaded = true;
  return data;
}

function courseQuestions(){
  return questions.filter(q => q.activa && (!cursoActual || q.curso === cursoActual));
}

function syncSubjectsForCourse(){
  const wrapper = document.getElementById('subject-wrapper');
  const list = document.getElementById('subject-list');
  const select = document.getElementById('subject');
  const current = document.getElementById('subject-current');
  if (!wrapper || !list || !select || !cursoActual) return;
  const available = new Set(courseQuestions().map(q=>q.asignatura));
  const subjects = AprendaliaCurriculum.subjects(cursoActual).filter(item=>available.has(item.id));
  list.innerHTML = subjects.map((item,i)=>`<li role="option" tabindex="0" data-value="${escapeHtml(item.id)}" aria-selected="${i===0?'true':'false'}">${escapeHtml(item.icon||'✨')} ${escapeHtml(item.label||item.id)}</li>`).join('');
  select.innerHTML = subjects.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.label||item.id)}</option>`).join('');
  if (!subjects.length) { wrapper.hidden = true; subjectSelected = ''; return; }
  if (!subjects.some(item=>item.id===subjectSelected)) subjectSelected = subjects[0].id;
  select.value = subjectSelected;
  list.querySelectorAll('li').forEach(li=>li.setAttribute('aria-selected', String(li.dataset.value===subjectSelected)));
  const selected = subjects.find(item=>item.id===subjectSelected) || subjects[0];
  current.innerText = `${selected.icon||'✨'} ${selected.label||selected.id}`;
  wrapper.hidden = false;
}

async function ensureQuestionsLoaded(){
  await ensureCurriculumLoaded();
  if (questions.length) return questions;
  const r = await fetch('questions.csv');
  if (!r.ok) throw new Error(`No se pudo cargar questions.csv (${r.status})`);
  const parsed = AprendaliaContent.parseQuestionsCsv(await r.text());
  const validation = AprendaliaContent.validateQuestions(parsed.headers, parsed.questions, AprendaliaCurriculum.current());
  if (!validation.ok) {
    console.error('Errores de contenido en questions.csv', validation.errors);
    throw new Error(`questions.csv contiene ${validation.errors.length} errores de estructura o currículo`);
  }
  questions = parsed.questions.filter(q=>q.activa);
  return questions;
}

async function showSessionSetup(){
  await ensureQuestionsLoaded();
  syncSubjectsForCourse();
  subjectSelected = document.getElementById('subject').value || subjectSelected;
  const setup = document.getElementById('session-setup');
  const game = document.getElementById('game');
  const icon = AprendaliaCurriculum.iconSubject(cursoActual, subjectSelected) || SUBJECT_UI[subjectSelected]?.[0] || '✨';
  const label = AprendaliaCurriculum.labelSubject(cursoActual, subjectSelected) || SUBJECT_UI[subjectSelected]?.[1] || subjectSelected;
  document.getElementById('setup-subject-icon').innerText = icon;
  document.getElementById('setup-title').innerText = label;
  document.getElementById('total-stars').innerText = getTotalStars();
  const setupCourse = document.getElementById('setup-course');
  if (setupCourse) setupCourse.innerText = `${AprendaliaCurriculum.labelCourse(cursoActual)} · ${usuarioActual}`;
  const summary = ProgressRepository.getSubjectSummary(usuarioActual, subjectSelected, courseQuestions(), cursoActual);
  const coverage = document.getElementById('setup-coverage');
  if (coverage) coverage.innerText = `${summary.seen}/${summary.total} preguntas vistas · ${summary.conceptCounts.mastered}/${summary.concepts.length} conceptos dominados`;
  document.getElementById('parents-zone').style.display = 'none';
  document.getElementById('parents-zone').setAttribute('aria-hidden','true');
  document.getElementById('parentsBtn').style.display = 'inline-flex';
  setup.style.display = 'block';
  setup.setAttribute('aria-hidden', 'false');
  game.style.display = 'none';
  document.getElementById('progress-track')?.classList.remove('is-active');
  document.getElementById('subject-wrapper')?.classList.remove('is-compact');
  updateBrandHomeState();
  document.getElementById('startSessionBtn')?.focus();
}

function openParentsGate(){
  const gate = document.getElementById('parents-gate');
  const input = document.getElementById('parentsPass');
  const error = document.getElementById('parentsPassError');
  if (!gate || !input) return;
  error.textContent = '';
  input.value = '';
  gate.style.display = 'grid';
  gate.setAttribute('aria-hidden', 'false');
  setTimeout(() => input.focus(), 0);
}

function closeParentsGate(){
  const gate = document.getElementById('parents-gate');
  if (!gate) return;
  gate.style.display = 'none';
  gate.setAttribute('aria-hidden', 'true');
  document.getElementById('parentsBtn')?.focus();
}

function unlockParentsZone(){
  const input = document.getElementById('parentsPass');
  const error = document.getElementById('parentsPassError');
  if (!input) return;
  if (AprendaliaAccess.authenticateParent(input.value)) {
    closeParentsGate();
    showParentsZone();
  } else {
    if (error) error.textContent = 'Contraseña incorrecta';
    input.select();
  }
}

async function showParentsZone(){
  await ensureQuestionsLoaded();
  subjectSelected = document.getElementById('subject').value || 'Lengua';
  document.getElementById('session-setup').style.display = 'none';
  document.getElementById('game').style.display = 'none';
  document.getElementById('parentsBtn').style.display = 'none';
  const zone = document.getElementById('parents-zone');
  zone.style.display = 'block';
  zone.setAttribute('aria-hidden','false');
  const panel = document.getElementById('progress-panel');
  panel.style.display = 'block';
  ProgressView.render(panel, usuarioActual, subjectSelected, courseQuestions(), { embedded:true, course:cursoActual });
}

function getExerciseLabel(tipo){
  const labels = {
    test:'Elige la respuesta', verdadero_falso:'Verdadero o falso', completar:'Completa la frase',
    ordenar:'Ponlo en orden', arrastrar:'Relaciona', cual_no_encaja:'¿Cuál no encaja?',
    escribir:'Escribe tu respuesta', clasificar:'Clasifica', guess:'Escucha y elige',
    listening:'Listening', pronunciar:'Pronunciación', hablar:'Speaking'
  };
  return labels[tipo] || 'Piensa y responde';
}


function isActiveQuestionSession(){
  const game = document.getElementById('game');
  return Boolean(
    game?.style.display === 'block' &&
    sessionStats &&
    !sessionStats.saved &&
    (current || queue.length)
  );
}

function abandonCurrentSession(){
  if (!isActiveQuestionSession()) return;
  const ok = window.confirm('¿Quieres salir de esta sesión? El progreso de las preguntas que ya has respondido se conservará.');
  if (!ok) return;

  trackActivity('session_abandoned', {
    estado: `${sessionStats?.presented || 0}/${sessionStats?.totalPlanned || SESSION_SIZE}`,
    durationMs: Math.max(0, Date.now() - new Date(sessionStats?.startedAt || Date.now()).getTime())
  });

  queue = [];
  current = null;
  questionLocked = false;
  sessionStats = null;
  score = 0;
  document.getElementById('score').innerText = '0';
  document.getElementById('streak').innerText = '0';
  document.getElementById('progress').innerText = `0/${SESSION_SIZE}`;
  document.getElementById('progress-bar').style.width = '0%';
  showSessionSetup();
}

function updateBrandHomeState(){
  const brand = document.getElementById('brandHome');
  if (!brand) return;
  const active = isActiveQuestionSession();
  brand.classList.toggle('can-exit-session', active);
  brand.setAttribute('aria-label', active ? 'Salir de la sesión y volver al inicio' : 'Aprendalia');
  brand.setAttribute('title', active ? 'Salir de la sesión' : 'Aprendalia');
}

async function startGame(){
  await ensureQuestionsLoaded();
  subjectSelected = document.getElementById('subject').value;

  const subjectQuestions = courseQuestions().filter(q=>q.asignatura===subjectSelected);
  queue = QuestionSelector.select(usuarioActual, subjectQuestions, SESSION_SIZE);

  if (!queue.length) {
    alert('Esta asignatura todavía no tiene preguntas disponibles.');
    showSessionSetup();
    return;
  }

  document.getElementById('session-setup').style.display = 'none';
  document.getElementById('session-setup').setAttribute('aria-hidden', 'true');
  document.getElementById('game').style.display = 'block';
  document.getElementById('progress-track')?.classList.add('is-active');
  document.getElementById('subject-wrapper')?.classList.add('is-compact');

  sessionStats = createSessionStats(queue.length);
  trackActivity('session_started', { estado: String(queue.length) });
  score = 0;
  updateSessionHud();
  nextQ();
  updateBrandHomeState();
}

function nextQ(){
  const q=document.getElementById('question');
  const a=document.getElementById('answers');
  const f=document.getElementById('feedback');
  const n=document.getElementById('next');
  const w=document.getElementById('writeAnswer');
  const c=document.getElementById('checkBtn');
  const s=document.getElementById('solucion');

  // 🔹 LIMPIAR SOLUCIÓN ANTERIOR
  s.innerText = '';
  s.style.display = 'none';

  a.innerHTML='';
  const aids = document.getElementById('learning-aids');
  if (aids) aids.style.display = 'flex';
  f.innerText='';
  n.style.display='none';
  w.style.display='none';
  c.style.display='none';
  
  // Habilitar controles al cargar nueva pregunta
  questionLocked = false;
  answerSubmitting = false;
  enableAnswerControls();

  const questionCard = document.querySelector('#game .question-card');
  if (questionCard) {
    questionCard.classList.remove('is-retry', 'question-enter');
    void questionCard.offsetWidth;
    questionCard.classList.add('question-enter');
  }

  if(!queue.length){
    renderSessionSummary();
    return;
  }

  current = queue.shift();
  current._outcomeRecorded = false;
  current._startedAt = new Date().toISOString();
  current._startedAtMs = Date.now();
  if (sessionStats) {
    sessionStats.presented += 1;
    updateSessionHud();
  }
  // Variable global para observabilidad
  preguntaActual = current;

  // ajustar tamaño del área de respuestas según el tipo
  const answersEl = document.getElementById('answers');
  answersEl.classList.remove('large');
  if(current.tipo === 'ordenar' || current.tipo === 'arrastrar') {
    answersEl.classList.add('large');
  }

  const eyebrow = document.getElementById('exercise-eyebrow');
  if (eyebrow) {
    const meta = AprendaliaCurriculum.resolve(current);
    eyebrow.innerText = `${getExerciseLabel(current.tipo)} · ${meta.topic} › ${meta.concept} · Nivel ${current.nivel}`;
  }

  current.usedHint = false;
  current.usedDontKnow = false;
  const hintBtn = document.getElementById('hintBtn');
  const dontKnowBtn = document.getElementById('dontKnowBtn');
  if (hintBtn) { hintBtn.style.display = 'inline-flex'; hintBtn.disabled = false; hintBtn.textContent = current.extra ? '💡 Pista' : '💡 Ayuda'; }
  if (dontKnowBtn) { dontKnowBtn.style.display = 'inline-flex'; dontKnowBtn.disabled = false; }

  // En ejercicios puramente auditivos no mostramos el texto objetivo.
  const hideQuestionText = ['listening', 'guess', 'pronunciar', 'hablar'].includes(current.tipo);
  q.innerText = hideQuestionText ? (current.tipo === 'pronunciar' || current.tipo === 'hablar' ? 'Escucha y repite' : 'Escucha con atención') : current.pregunta;

  if(current.tipo==='escribir'){
    w.value='';
    w.style.display='block';
    c.style.display='block';
  }
  else if(current.tipo==='ordenar'){
    renderOrder();
  }
  else if(current.tipo==='arrastrar'){
    renderDrag();
  }
  else if(current.tipo === 'listening'){
    renderListening();
  } 
  else if(current.tipo === 'guess'){
    renderListening();
  } 
  else if(current.tipo === 'pronunciar'){
    renderPronunciation();
  }
  else if (current.tipo === 'hablar') {
    renderSpeaking();
  }
  else if(current.tipo === 'cual_no_encaja'){
    renderNoEncaja();
  }
  else if(current.tipo === 'clasificar'){
    renderClasificar();
  }
  else if(current.tipo === 'completar'){
    renderCompletar();
  }
  else{
    current.opciones.split('|').forEach(o=>{
      const b=document.createElement('button');
      b.innerText=o;
      b.onclick=()=>finish(normalize(o)===normalize(current.respuesta), b);
      a.appendChild(b);
    });
  }
}

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ================================================ FUNCIONALIDADES =================================================== */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

function shuffle(array){
  for(let i = array.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array; // devuelve el array para que puedas asignarlo si quieres
}

function normalize(t){ return String(t ?? '').trim().toLowerCase(); }

function highlight(element, container) {
  container?.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
  element?.classList.add('highlight');
}

function normalizarNombre(nombre){
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function checkWrite(){
  finish(normalize(document.getElementById('writeAnswer').value)
        === normalize(current.respuesta), document.getElementById('checkBtn'));
}

function finish(ok, target = null) {
  const btn = target || getEventTarget();
  ok ? handleCorrect(btn) : handleError(btn);
}

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ================================================ TIPOS DE PREGUNTAS ================================================ */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

/* ================== COMPLETAR ================== */


/* ================== CLASIFICAR ================== */


/* ================== NO ENCAJA (¿Cuál no encaja?) ================== */


/* ================== HABLAR / SPEAKING ==================

   Tipo: 'hablar' (o 'speaking')
   - Reproduce audio (TTS por defecto, o URL en current.extra)
   - Permite grabar al alumno y transcribir en vivo si SpeechRecognition está disponible
   - Evalúa la transcripción comparándola con current.respuesta usando Levenshtein
*/


/* ================== PRONUNCIACIÓN / DICTADO ================== */

/* Tipo: 'pronunciar' (o 'dictado')
   - reproduce audio (TTS por defecto, o URL si current.extra contiene una URL http(s))
   - muestra input para escribir lo escuchado y botón comprobar
   - compara con tolerancia (Levenshtein)
*/


/* ================== LISTENING ================== */

let speechSupported = 'speechSynthesis' in window;
let listeningUtterance = null;


// Elige la voz inglesa preferida (opcional: se itera para preferir en-US > en-GB)



/* ================== ORDENAR ================== */

let touchItems = [];


// Pointer Events funciona con ratón, táctil y lápiz.


/* ================== ARRASTRAR ================== */

let selectedLeft = null;


/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ========================================== EFECTOS VISUALES Y SONIDOS ============================================== */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

// Confetti simple (genera pequeñas piezas y las anima)
// Asegura que exista un contenedor dentro de la tarjeta para el confeti
function ensureConfettiContainer(){
  let card = document.querySelector('.game-card') || document.body;
  // forzar position relative en la card para que los absolute internos funcionen
  const cardStyle = getComputedStyle(card).position;
  if(cardStyle === 'static'){
    card.style.position = 'relative';
  }
  let c = card.querySelector('#confetti-container');
  if(!c){
    c = document.createElement('div');
    c.id = 'confetti-container';
    card.appendChild(c);
  }
  return c;
}

function launchConfetti(target = null, count = 22){
  const container = ensureConfettiContainer();

  // calcular punto central donde "estallar"
  let origin = { x: container.clientWidth/2, y: container.clientHeight/3 };

  if(target instanceof HTMLElement){
    const tRect = target.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    // coordenadas relativas al contenedor
    origin.x = (tRect.left + tRect.right)/2 - cRect.left;
    origin.y = (tRect.top + tRect.bottom)/2 - cRect.top;
  } else if(typeof target === 'object' && typeof target.x === 'number' && typeof target.y === 'number'){
    origin.x = target.x;
    origin.y = target.y;
  } else if(typeof target === 'number'){
    // si llamaron launchConfetti(x,y,count) con x numérico: (no usado aquí)
    // dejar por defecto
  }

  const colors = ['#ff6b6b','#ffd93d','#6bd4ff','#9b8cff','#7ee787'];

  for(let i=0;i<count;i++){
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = (origin.x + (Math.random()*120 - 60)) + 'px';
    el.style.top = (origin.y + (Math.random()*40 - 20)) + 'px';
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.transform = `rotate(${Math.random()*360}deg)`;
    el.style.opacity = 1;
    el.style.width = (8 + Math.random()*8) + 'px';
    el.style.height = (10 + Math.random()*8) + 'px';

    // movimiento: usaremos transform + transition para "subir" y rotar
    const duration = 1200 + Math.random()*900;
    el.style.transition = `transform ${duration}ms cubic-bezier(.2,.8,.2,1), opacity ${duration/1.6}ms linear`;
    container.appendChild(el);

    // forzar un pequeño delay para que la transición se aplique
    requestAnimationFrame(() => {
      // el movimiento aleatorio hacia arriba + lateral
      const dx = (Math.random()*220 - 110);
      const dy = -(140 + Math.random()*120); // negativa = sube
      const rz = (Math.random()*720 - 360);
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rz}deg)`;
      el.style.opacity = '0';
    });

    // borrar después de la animación
    setTimeout(()=>{ if(el && el.parentNode) el.parentNode.removeChild(el); }, duration + 250);
  }
}

// micro-sonidos con WebAudio
const audioCtx = (typeof AudioContext !== 'undefined') ? new AudioContext() : null;
function playTone(freq = 440, dur = 0.12, type='sine'){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(audioCtx.destination);
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.16, audioCtx.currentTime + 0.01);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  setTimeout(()=>{ o.stop(); }, dur*1000 + 50);
}

function animarPuntos(){
  const s = document.getElementById('score');
  if(!s) return;
  s.classList.add('bump');
  const streak = document.getElementById('streak');
  if (sessionStats?.streak >= 3) streak?.classList.add('bump');
  setTimeout(()=>{ s.classList.remove('bump'); streak?.classList.remove('bump'); }, 300);
}

// llamar al a/fracaso visualmente
function visualAcierto(btn){
  if(btn) btn.classList.add('btn-correct');
  playTone(950, 0.12, 'sine');
  // quitar clase tras animación
  setTimeout(()=>{ if(btn) btn.classList.remove('btn-correct'); }, 900);
}
function visualError(btn){
  if(btn) btn.classList.add('btn-wrong');
  playTone(220, 0.18, 'sawtooth');
  setTimeout(()=>{ if(btn) btn.classList.remove('btn-wrong'); }, 700);
}

// Opciones del combo bonitas:
document.getElementById('startSessionBtn')?.addEventListener('click', startGame);
document.getElementById('hintBtn')?.addEventListener('click', revealHint);
document.getElementById('dontKnowBtn')?.addEventListener('click', handleDontKnow);
document.getElementById('parentsBtn')?.addEventListener('click', openParentsGate);
document.getElementById('closeParentsBtn')?.addEventListener('click', showSessionSetup);
document.getElementById('parentsUnlockBtn')?.addEventListener('click', unlockParentsZone);
document.getElementById('parentsGateCancelBtn')?.addEventListener('click', closeParentsGate);
document.getElementById('parentsPass')?.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') unlockParentsZone(); });
document.getElementById('parents-gate')?.addEventListener('click', (e)=>{ if(e.target?.id === 'parents-gate') closeParentsGate(); });
document.getElementById('brandHome')?.addEventListener('click', abandonCurrentSession);
document.getElementById('brandHome')?.addEventListener('keydown', (e)=>{
  if ((e.key === 'Enter' || e.key === ' ') && isActiveQuestionSession()) {
    e.preventDefault();
    abandonCurrentSession();
  }
});
document.addEventListener('keydown', (e)=>{
  if (e.key !== 'Escape') return;
  if (document.getElementById('help-dialog')?.style.display === 'grid') closeHelp();
  else if (document.getElementById('parents-gate')?.style.display === 'grid') closeParentsGate();
});

// Custom dropdown para asignaturas generadas dinámicamente desde curriculum.json.
(function(){
  const toggle=document.getElementById('subject-toggle');
  const list=document.getElementById('subject-list');
  const current=document.getElementById('subject-current');
  const nativeSelect=document.getElementById('subject');
  if(!toggle||!list)return;

  toggle.addEventListener('click',ev=>{
    ev.stopPropagation();
    const expanded=toggle.getAttribute('aria-expanded')==='true';
    toggle.setAttribute('aria-expanded',String(!expanded));
    list.style.display=expanded?'none':'block';
    if(!expanded) list.querySelector('li')?.focus();
  });

  function selectItem(li){
    if(!li)return;
    list.querySelectorAll('li').forEach(x=>x.setAttribute('aria-selected','false'));
    li.setAttribute('aria-selected','true');
    subjectSelected=li.dataset.value||'';
    if(nativeSelect) nativeSelect.value=subjectSelected;
    current.innerText=li.innerText;
    list.style.display='none'; toggle.setAttribute('aria-expanded','false');
    if(document.getElementById('welcome').style.display==='none'){
      const parentsOpen=document.getElementById('parents-zone')?.style.display==='block';
      parentsOpen?showParentsZone():showSessionSetup();
    }
  }

  list.addEventListener('click',ev=>selectItem(ev.target.closest('li[data-value]')));
  list.addEventListener('keydown',ev=>{
    const li=ev.target.closest('li[data-value]'); if(!li)return;
    if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();selectItem(li);}
    else if(ev.key==='ArrowDown'){ev.preventDefault();(li.nextElementSibling||list.querySelector('li'))?.focus();}
    else if(ev.key==='ArrowUp'){ev.preventDefault();(li.previousElementSibling||list.querySelector('li:last-child'))?.focus();}
  });

  document.addEventListener('click',ev=>{if(!toggle.contains(ev.target)&&!list.contains(ev.target)){list.style.display='none';toggle.setAttribute('aria-expanded','false');}});
})();

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ================================================== OBSERVABILIDAD ================================================== */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

function getDeviceKey(){
  return AprendaliaAccess?.getDeviceId?.() || 'unknown_device';
}

function getDeviceLabel(){
  return AprendaliaAccess?.getDeviceLabel?.() || 'unknown_device';
}

// Compatibilidad con los renderizadores existentes: los eventos de pregunta
// se envían como telemetría ligera y nunca son la fuente de verdad del progreso.
function registrarEvento(resultado) {
  if (!preguntaActual) return;
  trackActivity('question_result', {
    asignatura: preguntaActual.asignatura,
    questionId: preguntaActual.id,
    questionType: preguntaActual.tipo,
    estado: resultado
  });
}

// reportar pregunta confusa
function reportar() {
  if (!preguntaActual) return;
  registrarEvento("Confusa");
  const feedback = document.getElementById('feedback');
  feedback.innerText = '✅ Pregunta reportada. Gracias.';
}


function openHelp(){
  const dialog = document.getElementById('help-dialog');
  if (!dialog) return;
  dialog.style.display = 'grid';
  dialog.setAttribute('aria-hidden','false');
  document.getElementById('closeHelpBtn')?.focus();
}

function closeHelp(){
  const dialog = document.getElementById('help-dialog');
  if (!dialog) return;
  dialog.style.display = 'none';
  dialog.setAttribute('aria-hidden','true');
  document.getElementById('helpBtn')?.focus();
}

document.getElementById('helpBtn')?.addEventListener('click', openHelp);
document.getElementById('closeHelpBtn')?.addEventListener('click', closeHelp);
document.getElementById('help-dialog')?.addEventListener('click', e => { if (e.target?.id === 'help-dialog') closeHelp(); });

// Atajos de teclado sencillos para no depender siempre del ratón.
document.getElementById('pass')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});
document.getElementById('writeAnswer')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.currentTarget.disabled) checkWrite();
});
