#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const Content=require('../src/data/content-model.js');

const root=path.resolve(__dirname,'..');
const csv=fs.readFileSync(path.join(root,'questions.csv'),'utf8');
const curriculum=JSON.parse(fs.readFileSync(path.join(root,'curriculum.json'),'utf8'));
const parsed=Content.parseQuestionsCsv(csv);
const result=Content.validateQuestions(parsed.headers,parsed.questions,curriculum);

const combos=new Map();
for(const q of parsed.questions.filter(q=>q.activa)){
  const key=[q.curso,q.asignatura,q.tema,q.concepto,q.nivel,q.tipo].join(' | ');
  combos.set(key,(combos.get(key)||0)+1);
}
const badCounts=[...combos.entries()].filter(([,count])=>count!==10);

console.log(`Preguntas: ${parsed.questions.length}`);
console.log(`Combinaciones curso/asignatura/tema/concepto/nivel/tipo: ${combos.size}`);
console.log(`Errores estructurales: ${result.errors.length}`);
console.log(`Advertencias: ${result.warnings.length}`);
if(badCounts.length){
  console.error('Combinaciones que no tienen exactamente 10 preguntas:');
  badCounts.forEach(([key,count])=>console.error(`- ${key}: ${count}`));
}
if(result.errors.length){
  result.errors.slice(0,50).forEach(e=>console.error(`Fila ${e.row}: [${e.code}] ${e.message}`));
}
if(result.errors.length || badCounts.length) process.exit(1);
console.log('OK - contenido válido y 10 preguntas por combinación.');
