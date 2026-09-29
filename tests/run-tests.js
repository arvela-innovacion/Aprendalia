const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

class LocalStorageMock {
  constructor(){ this.map = new Map(); }
  get length(){ return this.map.size; }
  key(i){ return [...this.map.keys()][i] ?? null; }
  getItem(k){ return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k,v){ this.map.set(String(k),String(v)); }
  removeItem(k){ this.map.delete(k); }
  clear(){ this.map.clear(); }
}

const context = {
  console, Date, Math, JSON, Blob: global.Blob,
  URL: { createObjectURL:()=> 'blob:test', revokeObjectURL:()=>{} },
  document: { createElement:()=>({click(){}, set href(v){this._href=v}, get href(){return this._href}, set download(v){this._download=v}}) },
  alert:()=>{}, localStorage:new LocalStorageMock(),
  navigator:{userAgent:'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',platform:'Win32',maxTouchPoints:0},
  crypto:{randomUUID:()=> 'abcdef12-3456-7890-abcd-ef1234567890'},
};
context.window = context;
vm.createContext(context);
function load(file){ vm.runInContext(fs.readFileSync(file,'utf8'), context, {filename:file}); }

load('src/config/access-config.js');
let auth = context.AprendaliaAccess.authenticateStudent('alba','Alba27','DEV-XXXX-XXXX-XXXX');
assert.strictEqual(auth.ok,true,'empty device list allows any device');
assert.strictEqual(auth.course,'3EP','student login returns assigned course');
assert.strictEqual(context.AprendaliaAccess.getStudentProfile('ALBA').course,'3EP','profile exposes course');
auth = context.AprendaliaAccess.authenticateStudent('alba','wrong','DEV-XXXX-XXXX-XXXX');
assert.strictEqual(auth.ok,false,'wrong password remains blocked');

// v3 data is carried to v4 namespace so backups are not silently discarded.
context.localStorage.setItem('aprendalia:v3:progress:alba', JSON.stringify({legacy:{presentations:1}}));
load('src/data/storage.js');
assert.strictEqual(context.AprendaliaStorage.VERSION,4,'storage schema is v4');
assert.deepStrictEqual(context.AprendaliaStorage.get('progress:alba',{}).legacy.presentations,1,'migrates v3 storage');
load('src/data/progress-repository.js');
load('src/core/scoring-engine.js');
load('src/core/session-engine.js');
load('src/core/question-selector.js');
load('src/data/content-model.js');

const curriculum=JSON.parse(fs.readFileSync('curriculum.json','utf8'));
const typeCatalog=JSON.parse(fs.readFileSync('question-types.json','utf8'));
context.AprendaliaContent.setQuestionTypes(typeCatalog);
const csv=fs.readFileSync('questions.csv','utf8');
const parsed=context.AprendaliaContent.parseQuestionsCsv(csv);
const validation=context.AprendaliaContent.validateQuestions(parsed.headers,parsed.questions,curriculum);
assert.strictEqual(validation.ok,true,'generated CSV passes structural validation');
assert.strictEqual(parsed.questions.length,500,'test bank has 500 questions');
assert.strictEqual(parsed.questions.filter(q=>q.curso==='3EP'&&q.activa).length,500,'all sample questions belong to active 3EP bank');

// Curriculum metadata is descriptive: unknown topic/concept and type/level combinations must not block loading.
const permissiveCsv = [
  'id;curso;asignatura;tema;concepto;nivel;tipo;pregunta;opciones;respuesta_correcta;extra;activa',
  'PX1;3EP;Matematicas;numeracion;valor_posicional;2;test;¿Qué valor tiene el 5 en 542?;500|50|5|2;500;Pista;1',
  ';3EP;Ciencia;experimentos;;1;escribir;Escribe una palabra; ;agua;Pista;1'
].join('\n');
const permissiveParsed = context.AprendaliaContent.parseQuestionsCsv(permissiveCsv);
const permissiveValidation = context.AprendaliaContent.validateQuestions(permissiveParsed.headers,permissiveParsed.questions,curriculum);
assert.strictEqual(permissiveParsed.questions[1].concepto,'general','empty concept falls back to general');
assert.strictEqual(permissiveValidation.ok,false,'unknown subject is still blocked while topic/concept metadata stays free');
assert(permissiveValidation.errors.some(e=>e.code==='unknown_subject'),'unknown subject is blocked by closed curriculum');
const knownSubjectFreeMeta = {...permissiveParsed.questions[1], id:'PX2', asignatura:'Matematicas', tema:'experimentos', concepto:'concepto_nuevo'};
const freeMetaValidation = context.AprendaliaContent.validateQuestions(context.AprendaliaContent.REQUIRED_COLUMNS,[knownSubjectFreeMeta],curriculum);
assert.strictEqual(freeMetaValidation.ok,true,'new topic/concept is valid inside a configured subject');
assert.strictEqual(permissiveParsed.questions[1].id.startsWith('AUTO_'),true,'blank ID gets a deterministic generated ID');
assert.strictEqual(context.AprendaliaContent.generateStableId(permissiveParsed.questions[1]),permissiveParsed.questions[1].id,'generated ID is deterministic');
assert.strictEqual(permissiveValidation.warnings.length,0,'validation produces no curriculum warnings');

const relaxedCombo = [{id:'PX3',curso:'3EP',asignatura:'Matematicas',tema:'experimentos',concepto:'concepto_nuevo',nivel:3,tipo:'test',pregunta:'¿Cuál es una opción?',opciones:'A|B',respuesta:'A',activa:true,_activaRaw:'1'}];
const relaxedValidation = context.AprendaliaContent.validateQuestions(context.AprendaliaContent.REQUIRED_COLUMNS,relaxedCombo,curriculum);
assert.strictEqual(relaxedValidation.ok,true,'new topic/concept and valid type are accepted inside a configured subject');
const badType = {...relaxedCombo[0],id:'PX4',tipo:'tipo_inventado'};
const badTypeValidation = context.AprendaliaContent.validateQuestions(context.AprendaliaContent.REQUIRED_COLUMNS,[badType],curriculum);
assert.strictEqual(badTypeValidation.ok,false,'unknown exercise type remains blocked');
assert(badTypeValidation.errors.some(e=>e.code==='unsupported_type'),'unsupported type is the relevant blocking validation');
const unknownSubject = {...relaxedCombo[0],id:'PX5',asignatura:'Ciencia'};
const unknownSubjectValidation = context.AprendaliaContent.validateQuestions(context.AprendaliaContent.REQUIRED_COLUMNS,[unknownSubject],curriculum);
assert.strictEqual(unknownSubjectValidation.ok,false,'unconfigured subject remains blocked');
assert(unknownSubjectValidation.errors.some(e=>e.code==='unknown_subject'),'unknown subject is reported explicitly');
const duplicateQuestionCsv=[
  'id;curso;asignatura;tema;concepto;nivel;tipo;pregunta;opciones;respuesta_correcta;extra;activa',
  'D1;3EP;Matematicas;calculo;general;1;test;¿Cuál es mayor?;10|20|30;30;;1',
  'D2;3EP;Matematicas;calculo;general;1;test;¿Cuál es mayor?;30|10|20;30;;1'
].join('\n');
const duplicateParsed=context.AprendaliaContent.parseQuestionsCsv(duplicateQuestionCsv);
const duplicateValidation=context.AprendaliaContent.validateQuestions(duplicateParsed.headers,duplicateParsed.questions,curriculum);
assert.strictEqual(duplicateValidation.ok,false,'equivalent duplicate is blocked even if options are reordered');
assert(duplicateValidation.errors.some(e=>e.code==='duplicate_question'),'duplicate question is explicitly reported');

const q=(id,concept='sumas',level=1)=>({id,curso:'3EP',asignatura:'Matematicas',tema:'calculo',concepto:concept,nivel:level,tipo:'test',pregunta:`Pregunta ${id}`,respuesta:'A',activa:true});
const questions=[...Array.from({length:10},(_,i)=>q(`S${i+1}`,'sumas',1)),...Array.from({length:10},(_,i)=>q(`R${i+1}`,'restas',1))];

// Stable ID is the progress identity; editing wording does not orphan progress.
assert.strictEqual(context.ProgressRepository.questionKey(q('ID1')), 'ID1');
let now = new Date().toISOString();
let r = context.ProgressRepository.recordOutcome('ana', questions[0], {result:'correct',attempts:1,endedAt:now,durationMs:1000});
assert.strictEqual(r.intervalDays,1,'first clean success due in 1 day');
r = context.ProgressRepository.recordOutcome('ana', {...questions[0],pregunta:'Texto corregido'}, {result:'correct',attempts:1,endedAt:new Date(Date.now()+86400000).toISOString(),durationMs:1000});
assert.strictEqual(r.intervalDays,3,'same immutable ID retains progress after wording correction');
r = context.ProgressRepository.recordOutcome('ana', questions[0], {result:'wrong',attempts:2,endedAt:new Date().toISOString(),durationMs:1000});
assert.strictEqual(r.intervalDays,1,'wrong answer returns soon');
assert.strictEqual(r.successStreak,0,'wrong answer resets success streak');

let stats = context.SessionEngine.create(10);
let reward = context.ScoringEngine.awardCorrect(stats,{attempts:0,usedHint:true});
assert.strictEqual(reward.points,6,'hint caps reward at 6');
stats = context.SessionEngine.create(10);
reward = context.ScoringEngine.awardCorrect(stats,{attempts:0});
assert.strictEqual(reward.points,10,'clean first try gets 10');

// Concept-aware selector should mix concepts when both are available.
const picked = context.QuestionSelector.select('sergio', questions, 10);
assert.strictEqual(new Set(picked.map(x=>x.id)).size,picked.length,'selector has no duplicate questions');
assert(new Set(picked.map(x=>x.concepto)).size>=2,'selector diversifies across concepts');

// Concept summaries expose curricular progress.
for(let i=0;i<5;i++) context.ProgressRepository.recordOutcome('sergio', questions[i], {result:'correct',attempts:1,endedAt:new Date().toISOString(),durationMs:500});
const conceptSummaries=context.ProgressRepository.getConceptSummaries('sergio',questions);
assert.strictEqual(conceptSummaries.length,2,'two concept summaries are generated');
assert(conceptSummaries.find(c=>c.concept==='sumas').seenQuestions>=5,'concept summary counts seen questions');

// Session modes are functional, not only UI labels.
const reviewPicked=context.QuestionSelector.select('sergio',questions,10,{mode:'review'});
assert(reviewPicked.length>0,'review mode returns seen questions when progress exists');
assert(reviewPicked.every(item=>context.ProgressRepository.get('sergio',item)),'review mode prioritizes already seen questions');
const discoverPicked=context.QuestionSelector.select('sergio',questions,10,{mode:'discover'});
assert(discoverPicked.length===10,'discover mode can fill a normal session');
assert(discoverPicked.every(item=>!context.ProgressRepository.get('sergio',item)),'discover mode prioritizes unseen questions when enough are available');


stats = context.SessionEngine.create(10);
stats.firstTry=6; stats.secondTry=2; stats.failed=2; stats.stars=74; stats.bestStreak=4;
const history = context.SessionEngine.toHistory(stats,'Matematicas','3EP');
assert.strictEqual(history.course,'3EP');
assert.strictEqual(history.total,10);
context.ProgressRepository.saveSession('ana',history);
const backup = context.ProgressRepository.exportUserData('ana');
assert.strictEqual(backup.schemaVersion,4);
assert(Array.isArray(backup.sessions) && backup.sessions.length===1);
context.ProgressRepository.importUserData('copia',{progress:backup.progress,sessions:backup.sessions});
assert.strictEqual(context.ProgressRepository.getSessions('copia').length,1,'imports session backup');

console.log('OK - all Aprendalia core tests passed');
