(function(global){
  'use strict';

  const REQUIRED_COLUMNS = Object.freeze([
    'id','curso','asignatura','tema','concepto','nivel','tipo','pregunta','opciones','respuesta_correcta','extra','activa'
  ]);

  const SUPPORTED_TYPES = Object.freeze([
    'test','verdadero_falso','escribir','completar','ordenar','arrastrar','cual_no_encaja',
    'clasificar','listening','guess','pronunciar','hablar'
  ]);

  function parseDelimited(text, delimiter=';'){
    const rows=[];
    let row=[], cell='', quoted=false;
    const source=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<source.length;i++){
      const ch=source[i];
      if(quoted){
        if(ch==='"' && source[i+1]==='"'){ cell+='"'; i++; }
        else if(ch==='"') quoted=false;
        else cell+=ch;
      } else if(ch==='"') quoted=true;
      else if(ch===delimiter){ row.push(cell); cell=''; }
      else if(ch==='\n'){
        row.push(cell.replace(/\r$/,''));
        if(row.some(v=>String(v).trim()!=='')) rows.push(row);
        row=[]; cell='';
      } else cell+=ch;
    }
    row.push(cell.replace(/\r$/,''));
    if(row.some(v=>String(v).trim()!=='')) rows.push(row);
    return rows;
  }

  function parseQuestionsCsv(text){
    const rows=parseDelimited(text,';');
    if(!rows.length) return {headers:[],questions:[]};
    const headers=rows[0].map(x=>String(x).trim());
    const questions=rows.slice(1).map((cells,index)=>{
      const raw={}; headers.forEach((h,i)=>{ raw[h]=cells[i]??''; });
      return {
        ...raw,
        id:String(raw.id||'').trim(),
        curso:String(raw.curso||'').trim(),
        asignatura:String(raw.asignatura||'').trim(),
        tema:String(raw.tema||'').trim(),
        concepto:String(raw.concepto||'').trim(),
        nivel:Number(raw.nivel||0),
        tipo:String(raw.tipo||'').trim(),
        pregunta:String(raw.pregunta||''),
        opciones:String(raw.opciones||''),
        respuesta:String(raw.respuesta_correcta||''),
        respuesta_correcta:String(raw.respuesta_correcta||''),
        extra:String(raw.extra||''),
        _activaRaw:String(raw.activa||'').trim(),
        activa:['1','true','si','sí','yes'].includes(String(raw.activa||'').trim().toLowerCase()),
        _csvRow:index+2,
        attempts:0
      };
    });
    return {headers,questions};
  }

  function getCourse(curriculum, courseId){ return curriculum?.courses?.[courseId] || null; }
  function getSubject(curriculum, q){ return getCourse(curriculum,q.curso)?.subjects?.[q.asignatura] || null; }
  function getTopic(curriculum, q){ return getSubject(curriculum,q)?.topics?.[q.tema] || null; }
  function getConcept(curriculum, q){ return getTopic(curriculum,q)?.concepts?.[q.concepto] || null; }

  function validateQuestions(headers, questions, curriculum){
    const errors=[], warnings=[];
    const missing=REQUIRED_COLUMNS.filter(h=>!headers.includes(h));
    missing.forEach(h=>errors.push({row:1,code:'missing_column',message:`Falta la columna obligatoria ${h}`}));
    const ids=new Map();

    questions.forEach(q=>{
      const row=q._csvRow||'?';
      const err=(code,message)=>errors.push({row,code,message,id:q.id});
      const warn=(code,message)=>warnings.push({row,code,message,id:q.id});
      if(!q.id) err('missing_id','ID vacío');
      else if(ids.has(q.id)) err('duplicate_id',`ID duplicado; ya aparece en la fila ${ids.get(q.id)}`);
      else ids.set(q.id,row);
      if(!q.curso) err('missing_course','Curso vacío');
      if(!q.asignatura) err('missing_subject','Asignatura vacía');
      if(!q.tema) err('missing_topic','Tema vacío');
      if(!q.concepto) err('missing_concept','Concepto vacío');
      if(!Number.isInteger(q.nivel) || q.nivel < 1) err('invalid_level','Nivel debe ser un entero positivo');
      if(!SUPPORTED_TYPES.includes(q.tipo)) err('unsupported_type',`Tipo no soportado: ${q.tipo}`);
      if(!String(q.pregunta||'').trim()) err('missing_question','Pregunta vacía');
      if(!String(q.respuesta||'').trim()) err('missing_answer','Respuesta correcta vacía');

      const course=getCourse(curriculum,q.curso);
      if(!course) err('unknown_course',`Curso no definido en curriculum.json: ${q.curso}`);
      const subject=getSubject(curriculum,q);
      if(course && !subject) err('unknown_subject',`Asignatura no definida para ${q.curso}: ${q.asignatura}`);
      const topic=getTopic(curriculum,q);
      if(subject && !topic) err('unknown_topic',`Tema no definido: ${q.tema}`);
      const concept=getConcept(curriculum,q);
      if(topic && !concept) err('unknown_concept',`Concepto no definido: ${q.concepto}`);
      if(concept){
        if(Array.isArray(concept.levels) && !concept.levels.includes(q.nivel)) err('level_not_allowed',`Nivel ${q.nivel} no permitido para ${q.concepto}`);
        if(Array.isArray(concept.types) && !concept.types.includes(q.tipo)) err('type_not_allowed',`Tipo ${q.tipo} no configurado para ${q.concepto}`);
      }

      const opts=String(q.opciones||'').split('|').map(x=>x.trim()).filter(Boolean);
      const normalized=opts.map(x=>x.toLowerCase());
      if(new Set(normalized).size !== normalized.length) err('duplicate_options','Hay opciones duplicadas');
      if(['test','verdadero_falso','completar','cual_no_encaja','guess'].includes(q.tipo)){
        if(opts.length < 2) err('too_few_options',`El tipo ${q.tipo} necesita al menos 2 opciones`);
        if(!normalized.includes(String(q.respuesta||'').trim().toLowerCase())) err('answer_not_in_options','La respuesta correcta no aparece entre las opciones');
      }
      if(q.tipo==='ordenar'){
        const answerParts=String(q.respuesta||'').split('|').map(x=>x.trim()).filter(Boolean);
        if(opts.length < 2 || answerParts.length!==opts.length) err('invalid_order','Ordenar necesita el mismo número de elementos en opciones y respuesta');
      }
      if(q.tipo==='arrastrar'){
        const answerParts=String(q.respuesta||'').split('|').map(x=>x.trim()).filter(Boolean);
        if(opts.length < 2 || answerParts.length!==opts.length) err('invalid_matching','Arrastrar necesita el mismo número de elementos a izquierda y derecha');
      }
      if(q.tipo==='clasificar' && !String(q.respuesta||'').includes(':')) err('invalid_classification','Clasificar necesita categorías en formato Categoria:item,item|...');
      if(!['0','1','true','false','si','sí','yes','no'].includes(String(q._activaRaw||'').trim().toLowerCase())) err('invalid_active','activa sólo admite 0/1, true/false, sí/no');
    });

    return {ok:errors.length===0,errors,warnings};
  }

  function activeForCourse(questions, courseId){
    return questions.filter(q=>q.activa && q.curso===courseId);
  }

  const api={REQUIRED_COLUMNS,SUPPORTED_TYPES,parseDelimited,parseQuestionsCsv,validateQuestions,activeForCourse,getCourse,getSubject,getTopic,getConcept};
  global.AprendaliaContent=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
