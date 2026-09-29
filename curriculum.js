(function(global){
  'use strict';
  let data=null;
  let promise=null;

  async function load(){
    if(data) return data;
    if(!promise){
      promise=fetch('curriculum.json').then(r=>{
        if(!r.ok) throw new Error(`No se pudo cargar curriculum.json (${r.status})`);
        return r.json();
      }).then(json=>{ data=json; return data; });
    }
    return promise;
  }

  function current(){ return data; }
  function course(id){ return data?.courses?.[id] || null; }
  function subjects(courseId){
    const subjects=course(courseId)?.subjects || {};
    return Object.entries(subjects)
      .sort((a,b)=>(a[1].order||0)-(b[1].order||0))
      .map(([id,value])=>({id,...value}));
  }
  function subject(courseId,subjectId){ return course(courseId)?.subjects?.[subjectId] || null; }
  function humanizeId(value,fallback='') {
    const raw=String(value||fallback||'').trim();
    if(!raw) return '';
    return raw.replace(/[_-]+/g,' ').replace(/\s+/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase());
  }
  function labelCourse(courseId){ return course(courseId)?.label || humanizeId(courseId,'Curso sin definir') || 'Curso sin definir'; }
  function labelSubject(courseId,subjectId){ return subject(courseId,subjectId)?.label || humanizeId(subjectId,'Asignatura') || 'Asignatura'; }
  function labelTopic(q){ return humanizeId(q?.tema,'Tema') || 'Tema'; }
  function labelConcept(q){ return humanizeId(q?.concepto,'Concepto') || 'Concepto'; }
  function iconSubject(courseId,subjectId){ return subject(courseId,subjectId)?.icon || '✨'; }
  function resolve(q){
    return {
      course:labelCourse(q.curso),
      subject:labelSubject(q.curso,q.asignatura),
      topic:labelTopic(q),
      concept:labelConcept(q),
      level:q.nivel
    };
  }

  global.AprendaliaCurriculum={load,current,course,subjects,subject,labelCourse,labelSubject,labelTopic,labelConcept,iconSubject,resolve};
})(window);
