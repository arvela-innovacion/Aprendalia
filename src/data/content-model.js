(function(global){
  'use strict';

  const REQUIRED_COLUMNS = Object.freeze([
    'id','curso','asignatura','tema','concepto','nivel','tipo','pregunta','opciones','respuesta_correcta','extra','activa'
  ]);

  let questionTypes = Object.freeze({});
  let SUPPORTED_TYPES = Object.freeze([]);

  function normalizeKey(value=''){
    return String(value ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().trim();
  }

  function normalizeQuestionText(value=''){
    return normalizeKey(value)
      .replace(/[^a-z0-9áéíóúüñºª\s]/gi,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function stableIdSeed(question){
    return [question.curso,question.asignatura,question.tema,question.concepto,question.nivel,question.tipo,question.pregunta,question.respuesta]
      .map(normalizeQuestionText).join('|');
  }

  function hash32(input){
    let hash=2166136261;
    const s=String(input||'');
    for(let i=0;i<s.length;i++){
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash,16777619);
    }
    return (hash>>>0).toString(36).padStart(7,'0');
  }

  function generateStableId(question){ return `AUTO_${hash32(stableIdSeed(question))}`; }

  function setQuestionTypes(catalog){
    const raw=catalog?.questionTypes || catalog || {};
    const entries=Object.entries(raw).filter(([id,meta])=>id && meta && typeof meta==='object');
    questionTypes=Object.freeze(Object.fromEntries(entries));
    SUPPORTED_TYPES=Object.freeze(entries.map(([id])=>id));
    return SUPPORTED_TYPES.slice();
  }

  function getQuestionType(type){ return questionTypes[type] || null; }

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
    const width=headers.length;
    const questions=rows.slice(1).map((cells,index)=>{
      const raw={}; headers.forEach((h,i)=>{ raw[h]=cells[i]??''; });
      const normalized={
        ...raw,
        id:String(raw.id||'').trim(),
        curso:String(raw.curso||'').trim(),
        asignatura:String(raw.asignatura||'').trim(),
        tema:String(raw.tema||'').trim() || 'general',
        concepto:String(raw.concepto||'').trim() || 'general',
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
        _csvCellCount:cells.length,
        _csvExpectedCellCount:width,
        attempts:0
      };
      if(!normalized.id) normalized.id=generateStableId(normalized);
      normalized._generatedId=!String(raw.id||'').trim();
      return normalized;
    });
    return {headers,questions};
  }

  function getCourse(curriculum, courseId){ return curriculum?.courses?.[courseId] || null; }
  function getSubject(curriculum, q){ return getCourse(curriculum,q.curso)?.subjects?.[q.asignatura] || null; }

  // Topics and concepts are deliberately free metadata. Their labels are humanized IDs.
  function getTopic(curriculum, q){ return q?.tema ? {id:q.tema,label:humanizeId(q.tema)} : null; }
  function getConcept(curriculum, q){ return q?.concepto ? {id:q.concepto,label:humanizeId(q.concepto)} : null; }
  function humanizeId(value,fallback=''){
    const raw=String(value||fallback||'').trim();
    if(!raw) return '';
    return raw.replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase());
  }

  function duplicateKey(q){
    return [normalizeQuestionText(q.pregunta),normalizeQuestionText(q.respuesta),normalizeKey(q.tipo)].join('::');
  }

  function validateQuestions(headers, questions, curriculum){
    const errors=[], warnings=[];
    if(!SUPPORTED_TYPES.length){
      errors.push({row:1,code:'missing_question_types_catalog',message:'No se ha cargado question-types.json o no contiene tipos válidos'});
      return {ok:false,errors,warnings};
    }
    const missing=REQUIRED_COLUMNS.filter(h=>!headers.includes(h));
    missing.forEach(h=>errors.push({row:1,code:'missing_column',message:`Falta la columna obligatoria ${h}`}));
    if(headers.length!==new Set(headers).size){
      const duplicates=headers.filter((h,i)=>headers.indexOf(h)!==i);
      duplicates.forEach(h=>errors.push({row:1,code:'duplicate_column',message:`Columna duplicada: ${h}`}));
    }
    const ids=new Map();
    const duplicateQuestions=new Map();

    questions.forEach(q=>{
      const row=q._csvRow||'?';
      const err=(code,message)=>errors.push({row,code,message,id:q.id});
      if(q._csvExpectedCellCount && q._csvCellCount!==q._csvExpectedCellCount){
        err('invalid_column_count',`La fila tiene ${q._csvCellCount} columnas y se esperaban ${q._csvExpectedCellCount}`);
      }
      if(!q.id) err('missing_id','ID vacío');
      else if(ids.has(q.id)) err('duplicate_id',`ID duplicado; ya aparece en la fila ${ids.get(q.id)}`);
      else ids.set(q.id,row);
      if(!q.curso) err('missing_course','Curso vacío');
      if(!q.asignatura) err('missing_subject','Asignatura vacía');
      else if(curriculum && !getCourse(curriculum,q.curso)?.subjects?.[q.asignatura]) err('unknown_subject',`Asignatura no definida para ${q.curso}: ${q.asignatura}`);
      if(!String(q.tema||'').trim()) q.tema='general';
      if(!String(q.concepto||'').trim()) q.concepto='general';
      if(!Number.isInteger(q.nivel) || q.nivel<1 || q.nivel>3) err('invalid_level','Nivel debe ser un entero entre 1 y 3');

      const typeMeta=getQuestionType(q.tipo);
      if(!typeMeta) err('unsupported_type',`Tipo no soportado: ${q.tipo}`);
      if(!String(q.pregunta||'').trim()) err('missing_question','Pregunta vacía');
      if(!String(q.respuesta||'').trim()) err('missing_answer','Respuesta correcta vacía');

      const opts=String(q.opciones||'').split('|').map(x=>x.trim()).filter(Boolean);
      const normalized=opts.map(normalizeKey);
      if(new Set(normalized).size!==normalized.length) err('duplicate_options','Hay opciones duplicadas');
      if(typeMeta?.requiresOptions && !opts.length) err('missing_options',`El tipo ${q.tipo} necesita opciones`);
      if(typeMeta?.minOptions && opts.length<typeMeta.minOptions) err('too_few_options',`El tipo ${q.tipo} necesita al menos ${typeMeta.minOptions} opciones`);
      if(typeMeta?.maxOptions && opts.length>typeMeta.maxOptions) err('too_many_options',`El tipo ${q.tipo} admite como máximo ${typeMeta.maxOptions} opciones`);
      if(typeMeta?.singleAnswer && !normalized.includes(normalizeKey(q.respuesta))) err('answer_not_in_options','La respuesta correcta no aparece entre las opciones');
      if(q.tipo==='ordenar'){
        const answerParts=String(q.respuesta||'').split('|').map(x=>x.trim()).filter(Boolean);
        if(opts.length<2 || answerParts.length!==opts.length) err('invalid_order','Ordenar necesita el mismo número de elementos en opciones y respuesta');
      }
      if(q.tipo==='arrastrar'){
        const answerParts=String(q.respuesta||'').split('|').map(x=>x.trim()).filter(Boolean);
        if(opts.length<2 || answerParts.length!==opts.length) err('invalid_matching','Arrastrar necesita el mismo número de elementos a izquierda y derecha');
      }
      if(q.tipo==='clasificar' && !String(q.respuesta||'').includes(':')) err('invalid_classification','Clasificar necesita categorías en formato Categoria:item,item|...');
      if(!['0','1','true','false','si','sí','yes','no'].includes(String(q._activaRaw||'').trim().toLowerCase())) err('invalid_active','activa sólo admite 0/1, true/false, sí/no');

      const dk=duplicateKey(q);
      if(q.activa && String(q.pregunta||'').trim()){
        if(duplicateQuestions.has(dk)){
          const previous=duplicateQuestions.get(dk);
          err('duplicate_question',`Pregunta duplicada o equivalente a la fila ${previous.row} (mismo enunciado, respuesta y tipo)`);
        } else duplicateQuestions.set(dk,{row,id:q.id});
      }
    });

    return {ok:errors.length===0,errors,warnings};
  }

  function activeForCourse(questions, courseId){ return questions.filter(q=>q.activa && q.curso===courseId); }

  const api={REQUIRED_COLUMNS,get SUPPORTED_TYPES(){return SUPPORTED_TYPES.slice();},setQuestionTypes,getQuestionType,parseDelimited,parseQuestionsCsv,validateQuestions,activeForCourse,getCourse,getSubject,getTopic,getConcept,normalizeKey,normalizeQuestionText,generateStableId,duplicateKey};
  global.AprendaliaContent=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
