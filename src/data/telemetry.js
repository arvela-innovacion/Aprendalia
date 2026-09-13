(function(global){
  'use strict';

  // Compatibilidad con el contrato histórico de Google Apps Script / Sheets.
  // El progreso pedagógico vive en localStorage; Google recibe únicamente
  // observabilidad ligera asociada a preguntas, con el payload original.
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyGQhwjv79kDf8_rZAKKRw24bbC3j_MgTU5nexwB9R8LJlD4KbiG4LzU1bm21sRd8EUtA/exec';

  function send(eventName, data = {}) {
    // Los eventos internos de sesión/login pueden seguir existiendo en la app,
    // pero no se envían a Google para mantener compatibilidad total con el
    // Apps Script existente.
    if (!ENDPOINT || eventName !== 'question_result') return;

    const formData = new FormData();
    formData.append('fecha', new Date().toISOString().split('T')[0]);
    formData.append('alumno', data.alumno || '');
    formData.append('device_key', data.deviceKey || '');
    formData.append('device_info', data.deviceInfo || '');
    formData.append('asignatura', data.asignatura || '');
    formData.append('id_pregunta', data.questionId || '');
    formData.append('tipo_pregunta', data.questionType || '');
    formData.append('estado', data.estado || '');

    fetch(ENDPOINT, { method: 'POST', body: formData })
      .catch(err => console.warn('No se pudo registrar la actividad', err));
  }

  global.AprendaliaTelemetry = Object.freeze({ send });
})(window);
