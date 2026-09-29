#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const Content=require('../src/data/content-model.js');

const ROOT=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
function arg(name, fallback){const i=args.indexOf(`--${name}`);return i>=0?args[i+1]||fallback:fallback;}
const base=path.resolve(ROOT,arg('base','questions.csv'));
const dir=path.resolve(ROOT,arg('dir','question-banks'));
const out=path.resolve(ROOT,arg('out','questions.csv'));
const curriculum=JSON.parse(fs.readFileSync(path.join(ROOT,'curriculum.json'),'utf8'));
const typeCatalog=JSON.parse(fs.readFileSync(path.join(ROOT,'question-types.json'),'utf8'));
Content.setQuestionTypes(typeCatalog);

function csvEscape(value){
  const s=String(value??'');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function rowToCsv(q){
  const values=['id','curso','asignatura','tema','concepto','nivel','tipo','pregunta','opciones','respuesta_correcta','extra','activa'];
  return values.map(k=>csvEscape(k==='activa'?(q.activa?'1':'0'):q[k]??'')).join(';');
}
function readFile(file){
  const parsed=Content.parseQuestionsCsv(fs.readFileSync(file,'utf8'));
  const result=Content.validateQuestions(parsed.headers,parsed.questions,curriculum);
  if(result.errors.length){
    console.error(`\n${path.relative(ROOT,file)}:`);
    result.errors.slice(0,40).forEach(e=>console.error(`  Fila ${e.row}: [${e.code}] ${e.message}`));
    throw new Error('El bloque no es válido y no se puede compilar.');
  }
  return parsed.questions;
}

if(!fs.existsSync(base)) throw new Error(`No existe el banco base: ${base}`);
const files=fs.existsSync(dir) ? fs.readdirSync(dir).filter(f=>/\.csv$/i.test(f)).sort().map(f=>path.join(dir,f)) : [];
const sources=[base,...files.filter(f=>path.resolve(f)!==out)];
const all=[];
for(const file of sources) all.push(...readFile(file).map(q=>({...q,_source:path.relative(ROOT,file)})));

const seenId=new Map();
const seenQuestion=new Map();
let duplicateCount=0;
for(const q of all){
  if(seenId.has(q.id)) throw new Error(`ID duplicado ${q.id}: ${seenId.get(q.id)} y ${q._source}`);
  seenId.set(q.id,q._source);
  const key=Content.duplicateKey(q);
  if(seenQuestion.has(key)){
    duplicateCount++;
    throw new Error(`Pregunta duplicada/equivalente entre ${seenQuestion.get(key)} y ${q._source}: ${q.pregunta}`);
  }
  seenQuestion.set(key,q._source);
}

const headers=Content.REQUIRED_COLUMNS.join(';');
const output='\uFEFF'+[headers,...all.map(rowToCsv)].join('\n')+'\n';
fs.writeFileSync(out,output,'utf8');
const sourceSummary=sources.map(f=>`${path.relative(ROOT,f)}=${readFile(f).length}`).join(', ');
console.log(`Compiladas ${all.length} preguntas en ${path.relative(ROOT,out)}.`);
console.log(`Fuentes: ${sourceSummary}`);
console.log(`Duplicados: ${duplicateCount}`);
