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
const csv=fs.readFileSync('questions.csv','utf8');
const parsed=context.AprendaliaContent.parseQuestionsCsv(csv);
const validation=context.AprendaliaContent.validateQuestions(parsed.headers,parsed.questions,curriculum);
assert.strictEqual(validation.ok,true,'generated CSV matches curriculum');
assert.strictEqual(parsed.questions.length,480,'test bank has 480 questions');
assert.strictEqual(parsed.questions.filter(q=>q.curso==='3EP'&&q.activa).length,480,'all sample questions belong to active 3EP bank');

const comboCounts=new Map();
parsed.questions.forEach(q=>{
  const key=[q.curso,q.asignatura,q.tema,q.concepto,q.nivel,q.tipo].join('|');
  comboCounts.set(key,(comboCounts.get(key)||0)+1);
});
assert.strictEqual(comboCounts.size,48,'sample bank has 48 curriculum combinations');
assert([...comboCounts.values()].every(n=>n===10),'every combination has exactly 10 questions');

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
