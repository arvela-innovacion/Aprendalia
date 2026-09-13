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
    return Object.entries(subjects).sort((a,b)=>(a[1].order||0)-(b[1].order||0)).map(([id,value])=>({id,...value}));
  }
  function subject(courseId,subjectId){ return course(courseId)?.subjects?.[subjectId] || null; }
  function topic(courseId,subjectId,topicId){ return subject(courseId,subjectId)?.topics?.[topicId] || null; }
  function concept(courseId,subjectId,topicId,conceptId){ return topic(courseId,subjectId,topicId)?.concepts?.[conceptId] || null; }
  function labelCourse(courseId){ return course(courseId)?.label || courseId || 'Curso sin definir'; }
  function labelSubject(courseId,subjectId){ return subject(courseId,subjectId)?.label || subjectId || 'Asignatura'; }
  function labelTopic(q){ return topic(q.curso,q.asignatura,q.tema)?.label || q.tema || 'Tema'; }
  function labelConcept(q){ return concept(q.curso,q.asignatura,q.tema,q.concepto)?.label || q.concepto || 'Concepto'; }
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

  global.AprendaliaCurriculum={load,current,course,subjects,subject,topic,concept,labelCourse,labelSubject,labelTopic,labelConcept,iconSubject,resolve};
})(window);
