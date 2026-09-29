#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const Content=require('../src/data/content-model.js');

const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
const idx=args.indexOf('--file');
const file=path.resolve(root,idx>=0 ? (args[idx+1]||'questions.csv') : 'questions.csv');
const curriculum=JSON.parse(fs.readFileSync(path.join(root,'curriculum.json'),'utf8'));
const typeCatalog=JSON.parse(fs.readFileSync(path.join(root,'question-types.json'),'utf8'));
Content.setQuestionTypes(typeCatalog);
const parsed=Content.parseQuestionsCsv(fs.readFileSync(file,'utf8'));
const result=Content.validateQuestions(parsed.headers,parsed.questions,curriculum);

console.log(`Archivo: ${path.relative(root,file)}`);
console.log(`Preguntas: ${parsed.questions.length}`);
console.log(`Errores bloqueantes: ${result.errors.length}`);
console.log(`Avisos: ${result.warnings.length}`);
const exactDuplicates=new Map();
parsed.questions.forEach(q=>{if(!q.activa)return;const key=Content.duplicateKey(q);if(!exactDuplicates.has(key))exactDuplicates.set(key,[]);exactDuplicates.get(key).push(q);});
const dupGroups=[...exactDuplicates.values()].filter(group=>group.length>1);
console.log(`Grupos de preguntas duplicadas/equivalentes: ${dupGroups.length}`);
if(dupGroups.length){dupGroups.slice(0,20).forEach(group=>console.error(`- ${group.map(q=>`${q.id}(fila ${q._csvRow})`).join(', ')}: ${q}`));}
const generated=parsed.questions.filter(q=>q._generatedId).length;
if(generated) console.log(`Información: IDs autogenerados: ${generated}`);
if(result.errors.length){result.errors.slice(0,80).forEach(e=>console.error(`Fila ${e.row}: [${e.code}] ${e.message}`));process.exit(1);}
if(dupGroups.length) process.exit(2);
console.log('OK - contenido válido; asignaturas y tipos están configurados, tema y concepto son libres.');
