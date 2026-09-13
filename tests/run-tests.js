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
  console,
  Date,
  Math,
  JSON,
  Blob: global.Blob,
  URL: { createObjectURL:()=> 'blob:test', revokeObjectURL:()=>{} },
  document: { createElement:()=>({click(){}, set href(v){this._href=v}, get href(){return this._href}, set download(v){this._download=v}}) },
  alert:()=>{},
  localStorage:new LocalStorageMock(),
  navigator:{userAgent:'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',platform:'Win32',maxTouchPoints:0},
  crypto:{randomUUID:()=> 'abcdef12-3456-7890-abcd-ef1234567890'},
};
context.window = context;
vm.createContext(context);

function load(file){ vm.runInContext(fs.readFileSync(file,'utf8'), context, {filename:file}); }


// Access policy: empty device list is permissive; populated list is restrictive.
load('src/config/access-config.js');
let auth = context.AprendaliaAccess.authenticateStudent('alba','Alba27','DEV-XXXX-XXXX-XXXX');
assert.strictEqual(auth.ok,true,'empty device list allows any device');
auth = context.AprendaliaAccess.authenticateStudent('alba','wrong','DEV-XXXX-XXXX-XXXX');
assert.strictEqual(auth.ok,false,'wrong password remains blocked');

// Seed legacy data before storage loads to test migration.
context.localStorage.setItem('aprendalia:v2:progress:alba', JSON.stringify({legacy:{presentations:1}}));
load('src/data/storage.js');
assert.deepStrictEqual(context.AprendaliaStorage.get('progress:alba',{}).legacy.presentations,1,'migrates v2 storage');
load('src/data/progress-repository.js');
load('src/core/scoring-engine.js');
load('src/core/session-engine.js');
load('src/core/question-selector.js');

const q = (id)=>({id,asignatura:'Matematicas',tipo:'test',pregunta:`Pregunta ${id}`,respuesta:'A'});
const questions = Array.from({length:20},(_,i)=>q(`Q${i+1}`));

// Spaced repetition: clean correct schedules increasing intervals.
let now = new Date().toISOString();
let r = context.ProgressRepository.recordOutcome('ana', questions[0], {result:'correct',attempts:1,endedAt:now,durationMs:1000});
assert.strictEqual(r.intervalDays,1,'first clean success due in 1 day');
r = context.ProgressRepository.recordOutcome('ana', questions[0], {result:'correct',attempts:1,endedAt:new Date(Date.now()+86400000).toISOString(),durationMs:1000});
assert.strictEqual(r.intervalDays,3,'second clean success due in 3 days');
r = context.ProgressRepository.recordOutcome('ana', questions[0], {result:'wrong',attempts:2,endedAt:new Date().toISOString(),durationMs:1000});
assert.strictEqual(r.intervalDays,1,'wrong answer returns soon');
assert.strictEqual(r.successStreak,0,'wrong answer resets success streak');

// Assisted scoring never gets full first-try reward.
let stats = context.SessionEngine.create(10);
let reward = context.ScoringEngine.awardCorrect(stats,{attempts:0,usedHint:true});
assert.strictEqual(reward.points,6,'hint caps reward at 6');
stats = context.SessionEngine.create(10);
reward = context.ScoringEngine.awardCorrect(stats,{attempts:0});
assert.strictEqual(reward.points,10,'clean first try gets 10');
stats = context.SessionEngine.create(10);
reward = context.ScoringEngine.awardCorrect(stats,{attempts:0,usedSelfAssessment:true});
assert.strictEqual(reward.points,6,'manual speaking self-assessment is assisted');

// Coverage guarantee: with many unseen, at least half of session is unseen.
for(let i=0;i<8;i++){
  context.ProgressRepository.recordOutcome('sergio', questions[i], {result:i<3?'wrong':'correct',attempts:i<3?2:1,endedAt:new Date().toISOString(),durationMs:500});
}
const picked = context.QuestionSelector.select('sergio', questions, 10);
const unseenCount = picked.filter(x=>!context.ProgressRepository.get('sergio',x)).length;
assert(unseenCount >= 5,`expected >=5 unseen, got ${unseenCount}`);
assert.strictEqual(new Set(picked.map(x=>x.id)).size,picked.length,'selector has no duplicate questions');

// Session history and backup/import.
stats = context.SessionEngine.create(10);
stats.firstTry=6; stats.secondTry=2; stats.failed=2; stats.stars=74; stats.bestStreak=4;
const history = context.SessionEngine.toHistory(stats,'Matematicas');
assert.strictEqual(history.total,10);
assert.strictEqual(history.correct,8);
context.ProgressRepository.saveSession('ana',history);
const backup = context.ProgressRepository.exportUserData('ana');
assert.strictEqual(backup.schemaVersion,3);
assert(Array.isArray(backup.sessions) && backup.sessions.length===1);
context.ProgressRepository.importUserData('copia',{progress:backup.progress,sessions:backup.sessions});
assert.strictEqual(context.ProgressRepository.getSessions('copia').length,1,'imports session backup');

console.log('OK - all Aprendalia core tests passed');
