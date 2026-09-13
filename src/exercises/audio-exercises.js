'use strict';
function renderSpeaking(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  // Instrucción
  const info = document.createElement('div');
  info.innerText = '🎤 Repite lo que oyes:';
  info.className = 'exercise-info';
  a.appendChild(info);

  // Contenedor audio / play
  const audioContainer = document.createElement('div');
  audioContainer.className = 'audio-panel';
  a.appendChild(audioContainer);

  // Botón reproducir (puede usar URL si current.extra)
  const playBtn = document.createElement('button');
  playBtn.id = 'playSpeakBtn';
  playBtn.innerText = '🔊 Escuchar';
  playBtn.className = 'primary-btn';
  playBtn.setAttribute('aria-pressed','false');
  audioContainer.appendChild(playBtn);

  // Si extra contiene URL, usamos <audio>, si no usamos TTS con playListeningText
  const hasAudioUrl = current.extra && /^https?:\/\//i.test(current.extra.trim());
  let audioEl = null;
  if(hasAudioUrl){
    audioEl = document.createElement('audio');
    audioEl.src = current.extra.trim();
    audioEl.preload = 'auto';
    audioContainer.appendChild(audioEl);
  }

  playBtn.onclick = () => {
    if(audioEl){
      if(!audioEl.paused){
        audioEl.pause();
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
      } else {
        audioEl.currentTime = 0;
        audioEl.play().catch(()=>{});
        playBtn.innerText = '▶️ Reproduciendo...';
        playBtn.setAttribute('aria-pressed','true');
        audioEl.onended = ()=> {
          playBtn.innerText = '🔊 Escuchar';
          playBtn.setAttribute('aria-pressed','false');
        };
      }
      return;
    }
    if(listeningUtterance){
      stopListeningPlayback();
      playBtn.innerText = '🔊 Escuchar';
      playBtn.setAttribute('aria-pressed','false');
      return;
    }
    playBtn.innerText = '▶️ Reproduciendo...';
    playBtn.setAttribute('aria-pressed','true');

    // Reproducimos la respuesta (texto objetivo) por TTS
    playListeningText(current.respuesta || current.pregunta,
      () => {},
      () => {
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
      },
      (err) => {
        console.error('TTS error', err);
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
        const f = document.getElementById('feedback');
        if(f) f.innerText = '🔈 No se pudo reproducir el audio en este navegador.';
      }
    );
  };

  // ======================================================
  // Controles de grabación / reconocimiento
  // ======================================================
  const recContainer = document.createElement('div');
  recContainer.className = 'record-panel';
  a.appendChild(recContainer);

  const recBtn = document.createElement('button');
  recBtn.innerText = '🔴 Grabar';

  const stopRecBtn = document.createElement('button');
  stopRecBtn.innerText = '⏹ Parar';
  stopRecBtn.disabled = true;

  const playRecBtn = document.createElement('button');
  playRecBtn.innerText = '▶️ Reproducir mi grabación';
  playRecBtn.disabled = true;

  recContainer.appendChild(recBtn);
  recContainer.appendChild(stopRecBtn);
  recContainer.appendChild(playRecBtn);

  // Área para mostrar transcripción automática (si hay)
  const autoTransDiv = document.createElement('div');
  autoTransDiv.className = 'transcription';
  autoTransDiv.id = 'autoTranscription';
  a.appendChild(autoTransDiv);

  // audio element para reproducir la grabación local
  let recordedAudioEl = document.createElement('audio');
  recordedAudioEl.controls = false;

  a.appendChild(recordedAudioEl);

  // Variables de recording
  let mediaStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordedBlob = null;

  // SpeechRecognition si está disponible
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  let recognizer = null;
  let interimTranscript = '';
  let finalTranscript = '';

  // normalizador para comparar (quita acentos y puntuación)
  function normalizeForCompare(t){
    if(!t && t !== '') return '';
    return String(t).trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]|_/g, "")
      .replace(/\s+/g, ' ');
  }

  // Levenshtein (local pequeño)
  function levenshtein(a,b){
    if(a===b) return 0;
    const al = a.length, bl = b.length;
    if(al === 0) return bl;
    if(bl === 0) return al;
    const matrix = Array.from({length: al+1}, (_,i) => Array(bl+1).fill(0));
    for(let i=0;i<=al;i++) matrix[i][0] = i;
    for(let j=0;j<=bl;j++) matrix[0][j] = j;
    for(let i=1;i<=al;i++){
      for(let j=1;j<=bl;j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i-1][j] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j-1] + cost
        );
      }
    }
    return matrix[al][bl];
  }

  // evaluación: devuelve true/false según tolerancia
  function evaluateTranscription(transcript){
    const expectedRaw = current.respuesta || current.pregunta || '';
    const aNorm = normalizeForCompare(expectedRaw);
    const tNorm = normalizeForCompare(transcript || '');

    if(aNorm === tNorm) return true;

    const dist = levenshtein(aNorm, tNorm);
    const allowed = Math.max(1, Math.floor(aNorm.length * 0.20)); // 20% de la longitud
    return dist <= allowed;
  }

  // Start recording + start recognizer (si existe)
  recBtn.onclick = async () => {
    if(!canRecord){
      const f = document.getElementById('feedback');
      if(f) f.innerText = 'ℹ️ Este navegador no permite grabar audio. Escucha, repite en voz alta y usa la comprobación manual.';
      return;
    }
    // pedir micrófono
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(err){
      console.error('No se pudo acceder al micrófono', err);
      const f = document.getElementById('feedback');
      if(f) f.innerText = '⛔ No se pudo acceder al micrófono. Comprueba permisos.';
      return;
    }

    recordedChunks = [];
    const options = {};
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options.mimeType = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) options.mimeType = 'audio/ogg;codecs=opus';

    try { mediaRecorder = new MediaRecorder(mediaStream, options); }
    catch(e){ mediaRecorder = new MediaRecorder(mediaStream); }

    mediaRecorder.ondataavailable = e => { if(e.data && e.data.size) recordedChunks.push(e.data); };

    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'audio/webm' });
      const url = URL.createObjectURL(recordedBlob);
      recordedAudioEl.src = url;
      playRecBtn.disabled = false;
      const f = document.getElementById('feedback');
      if(f) f.innerText = '✅ Grabación lista';
      // Si no hay reconocimiento disponible avisamos que la evaluación automática no existe
      if(!SpeechRecognition){
        autoTransDiv.innerText = 'ℹ️ Evaluación automática no disponible en este navegador. La grabación se puede escuchar y descargar.';
      }
      // liberamos micrófono
      if(mediaStream){
        mediaStream.getTracks().forEach(t=>t.stop());
        mediaStream = null;
      }
    };

    mediaRecorder.start();

    // Iniciar SpeechRecognition en paralelo si existe
    finalTranscript = '';
    interimTranscript = '';
    autoTransDiv.innerText = '';
    if(SpeechRecognition){
      try {
        recognizer = new SpeechRecognition();
        recognizer.lang = 'en-US'; // adaptalo según tu curso
        recognizer.interimResults = true;
        recognizer.maxAlternatives = 1;

        recognizer.onresult = (event) => {
          interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          autoTransDiv.innerText = '📝 ' + (finalTranscript + interimTranscript);
        };

        recognizer.onerror = (ev) => {
          console.warn('SpeechRecognition error', ev);
        };

        recognizer.onend = () => {
          // al terminar reconocimiento (por silencio o stop), evaluamos si tenemos transcript
          const overall = (finalTranscript || '').trim();
          if(overall){
            autoTransDiv.innerText = '📝 Transcripción automática: ' + overall;
            const ok = evaluateTranscription(overall);
            // Llamamos a finish con el resultado (acierto/ fallo)
            finish(ok, recBtn);
          } else {
            // no se recogió nada
            autoTransDiv.innerText = '⚠ No se detectó voz claramente. Intenta de nuevo en un sitio más silencioso.';
            finish(false);
          }
        };

        recognizer.start();
      } catch(e){
        console.warn('No se pudo iniciar SpeechRecognition', e);
      }
    }

    // UI toggles
    recBtn.disabled = true;
    stopRecBtn.disabled = false;
    playRecBtn.disabled = true;
    const f = document.getElementById('feedback');
    if(f) f.innerText = '🎤 Grabando...';
  };

  // Stop recording: detiene MediaRecorder y SpeechRecognition (si existe)
  stopRecBtn.onclick = () => {
    try { if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch(e){}
    try { if(recognizer) { recognizer.stop(); recognizer = null; } } catch(e){}
    stopRecBtn.disabled = true;
    recBtn.disabled = false;
  };

  // Reproducir la grabación local
  playRecBtn.onclick = () => {
    try { recordedAudioEl.play(); } catch(e){}
  };

  // Permitir reintentos: dejamos que el nextQ / handleError controlen intentos
  // Nota: finish(true/false) ya se llama automáticamente cuando el recognizer finaliza (si hay)
  // Si no hay recognizer, no llamamos finish: queda a revisión manual (o puedes decidir enviar blob a servidor)

  // Fallback seguro: si no existe reconocimiento de voz, el ejercicio nunca queda bloqueado.
  // El alumno escucha, repite en voz alta y confirma manualmente; se registra como respuesta asistida.
  if(!SpeechRecognition){
    const fallback = document.createElement('div');
    fallback.className = 'speaking-fallback';

    const note = document.createElement('div');
    note.className = 'exercise-info';
    note.innerText = canRecord
      ? 'ℹ️ Este navegador no puede comprobar automáticamente la pronunciación. Puedes grabarte, escucharte y confirmar cuando la hayas repetido.'
      : 'ℹ️ Este navegador no puede comprobar ni grabar automáticamente. Escucha la frase, repítela en voz alta y confirma para continuar.';

    const confirmBtn = document.createElement('button');
    confirmBtn.innerText = '✅ Ya lo he dicho';
    confirmBtn.className = 'primary-btn';
    confirmBtn.onclick = () => {
      if(questionLocked) return;
      current.usedSelfAssessment = true;
      handleCorrect(confirmBtn);
    };

    fallback.appendChild(note);
    fallback.appendChild(confirmBtn);
    a.appendChild(fallback);

    if(!canRecord){
      recBtn.disabled = true;
      stopRecBtn.disabled = true;
      playRecBtn.disabled = true;
    }
  }

  // foco y sugerencia UX
  setTimeout(()=>{ recBtn.focus(); }, 200);
}

function renderPronunciation(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  // Instrucción
  const info = document.createElement('div');
  info.innerText = '🔊 Escucha y escribe lo que oigas:';
  info.className = 'exercise-info';
  a.appendChild(info);

  // Contenedor para el botón de reproducir y posibles controles de audio
  const audioContainer = document.createElement('div');
  audioContainer.className = 'audio-panel';
  a.appendChild(audioContainer);

  // Botón de reproducir (reutilizamos el patrón de renderListening)
  const playBtn = document.createElement('button');
  playBtn.id = 'playPronunciationBtn';
  playBtn.innerText = '🔊 Escuchar';
  playBtn.className = 'primary-btn';
  playBtn.setAttribute('aria-pressed','false');

  // Si current.extra es una URL http(s) válida, reproducimos ese audio en vez de TTS
  const hasAudioUrl = current.extra && /^https?:\/\//i.test(current.extra.trim());
  let audioEl = null;
  if(hasAudioUrl){
    audioEl = document.createElement('audio');
    audioEl.src = current.extra.trim();
    // no mostrar controles por defecto (botón ya lo controla)
    audioEl.preload = 'auto';
    audioContainer.appendChild(audioEl);
  }

  playBtn.onclick = () => {
    // Si hay audio nativo, reproducir / pausar ese audio
    if(audioEl){
      if(!audioEl.paused){
        audioEl.pause();
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
      } else {
        audioEl.currentTime = 0;
        audioEl.play().catch(()=>{ /* ignore */ });
        playBtn.innerText = '▶️ Reproduciendo...';
        playBtn.setAttribute('aria-pressed','true');
        audioEl.onended = () => {
          playBtn.innerText = '🔊 Escuchar';
          playBtn.setAttribute('aria-pressed','false');
        };
      }
      return;
    }

    // Si no hay URL, usar TTS con la frase objetivo (current.pregunta si quieres que sea la frase,
    // o current.respuesta si prefieres reproducir la respuesta exacta). Aquí uso current.respuesta
    // para que lo que se escucha sea lo esperado a escribir.
    if(listeningUtterance){ // si ya está reproduciendo
      stopListeningPlayback();
      playBtn.innerText = '🔊 Escuchar';
      playBtn.setAttribute('aria-pressed','false');
      return;
    }

    playBtn.innerText = '▶️ Reproduciendo...';
    playBtn.setAttribute('aria-pressed','true');

    // Reutiliza playListeningText (define en tu script) — forzamos idioma inglés
    // reproducimos current.respuesta (asume la transcripción correcta). Si prefieres reproducir
    // otra cosa, ajusta aquí.
    playListeningText(current.respuesta || current.pregunta,
      () => {},
      () => {
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
      },
      (err) => {
        console.error('TTS error', err);
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
        const f = document.getElementById('feedback');
        if(f) f.innerText = '🔈 No se pudo reproducir el audio en este navegador.';
      }
    );
  };

  audioContainer.appendChild(playBtn);

  // Mostrar input y botón comprobar (usa los mismos elementos de tu UI para compatibilidad)
  const write = document.getElementById('writeAnswer');
  const check = document.getElementById('checkBtn');

  // Aseguramos que existan; si no, los creamos dinámicamente
  if(!write){
    const w = document.createElement('input');
    w.type = 'text';
    w.id = 'writeAnswer';
    w.setAttribute('aria-label','Escribe lo que oíste');
    w.style.display = 'block';
    a.appendChild(w);
  } else {
    write.value = '';
    write.style.display = 'block';
  }

  if(!check){
    const cb = document.createElement('button');
    cb.id = 'checkBtn';
    cb.innerText = 'Comprobar';
    cb.style.display = 'block';
    cb.className = 'primary-btn';
    cb.onclick = checkPronunciation;
    a.appendChild(cb);
  } else {
    check.style.display = 'block';
    check.onclick = checkPronunciation;
  }

  // small helper: normalización (similar a normalize pero quitamos puntuación)
  function normalizeForCompare(t){
    if(!t && t !== '') return '';
    // convertir a string, quitar acentos, minusculas, quitar puntuación y espacios extras
    let s = String(t).trim().toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .replace(/[^\w\s]|_/g, "")   // quita signos de puntuación
              .replace(/\s+/g, ' ');       // colapsa espacios multiples
    return s;
  }

  // Levenshtein simple para tolerancia
  function levenshtein(a,b){
    if(a===b) return 0;
    const al = a.length, bl = b.length;
    if(al === 0) return bl;
    if(bl === 0) return al;
    const matrix = Array.from({length: al+1}, (_,i) => Array(bl+1).fill(0));
    for(let i=0;i<=al;i++) matrix[i][0] = i;
    for(let j=0;j<=bl;j++) matrix[0][j] = j;
    for(let i=1;i<=al;i++){
      for(let j=1;j<=bl;j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i-1][j] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j-1] + cost
        );
      }
    }
    return matrix[al][bl];
  }

  // Comprueba la respuesta con tolerancia
  function checkPronunciation(){
    const user = (document.getElementById('writeAnswer') || document.querySelector('#answers input')).value || '';
    const expectedRaw = current.respuesta || current.pregunta || '';
    const aNorm = normalizeForCompare(expectedRaw);
    const uNorm = normalizeForCompare(user);

    // exact match rápido
    if(aNorm === uNorm){
      finish(true);
      return;
    }

    // tolerancia basada en longitud: aceptamos pequeñas faltas
    const dist = levenshtein(aNorm, uNorm);
    const allowed = Math.max(1, Math.floor(aNorm.length * 0.15)); // 15% del tamaño, mínimo 1

    if(dist <= allowed){
      finish(true);
    } else {
      finish(false);
    }
  }

  // foco en el input para que el alumno pueda escribir tras escuchar
  setTimeout(()=> {
    const w = document.getElementById('writeAnswer');
    if(w) w.focus();
  }, 200);
}

function renderListening(){
  console.log('Opciones actuales:', current.opciones); // <--- Audit
  const a = document.getElementById('answers');
  a.innerHTML = '';

  // Contenedor para audio
  const audioContainer = document.createElement('div');
  audioContainer.className = 'audio-panel';
  a.appendChild(audioContainer);

  // Botón grande para reproducir
  const playBtn = document.createElement('button');
  playBtn.id = 'playListeningBtn';
  playBtn.innerText = '🔊 Escuchar en inglés';
  playBtn.className = 'primary-btn';
  playBtn.setAttribute('aria-pressed','false');

  playBtn.onclick = () => {
    if(listeningUtterance) { 
      stopListeningPlayback(); 
      playBtn.innerText = '🔊 Escuchar en inglés'; 
      playBtn.setAttribute('aria-pressed','false'); 
      return; 
    }

    playBtn.innerText = '▶️ Reproduciendo...';
    playBtn.setAttribute('aria-pressed','true');

    playListeningText(current.pregunta,
      () => {},
      () => {
        playBtn.innerText = '🔊 Escuchar en inglés';
        playBtn.setAttribute('aria-pressed','false');
      },
      (err) => {
        console.error('TTS error', err);
        playBtn.innerText = '🔊 Escuchar en inglés';
        playBtn.setAttribute('aria-pressed','false');
        const f = document.getElementById('feedback');
        if(f) f.innerText = '🔈 No se pudo reproducir el audio en este navegador.';
      }
    );
  };

  audioContainer.appendChild(playBtn);

  // Renderizar siempre las opciones si existen
  console.log('Opciones para renderizar:', current.opciones);
  if(current.opciones && current.opciones.trim() !== ''){
    const optsContainer = document.createElement('div');
    optsContainer.className = 'exercise-options';
    a.appendChild(optsContainer);

    const opts = shuffle(current.opciones.split('|'));
    opts.forEach(o=>{
      const b = document.createElement('button');
      b.innerText = o;
      b.onclick = ()=> finish(normalize(o) === normalize(current.respuesta), b);
      optsContainer.appendChild(b);
    });
  }
}

function chooseEnglishVoice() {
  const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
  if(!voices || !voices.length) return null;
  // preferencias: en-US, en-GB, cualquier en-*
  let v = voices.find(v=>/en-US/i.test(v.lang)) ||
          voices.find(v=>/en-GB/i.test(v.lang)) ||
          voices.find(v=>/^en\b/i.test(v.lang));
  return v || voices[0];
}

function playListeningText(text, onStart, onEnd, onError) {
  if(!speechSupported){
    if(onError) onError(new Error('SpeechSynthesis no soportado'));
    return;
  }

  // Cancelar cualquier reproducción previa
  try { speechSynthesis.cancel(); } catch(e){}

  listeningUtterance = new SpeechSynthesisUtterance(String(text));
  listeningUtterance.lang = 'en-US'; // forzar inglés; cambiar a 'en-GB' si prefieres
  const voice = chooseEnglishVoice();
  if(voice) listeningUtterance.voice = voice;

  listeningUtterance.onstart = () => { if(onStart) onStart(); };
  listeningUtterance.onend = () => { if(onEnd) onEnd(); listeningUtterance = null; };
  listeningUtterance.onerror = (ev) => { if(onError) onError(ev.error || ev); listeningUtterance = null; };

  // velocidad y tono se pueden ajustar si quieres:
  listeningUtterance.rate = 0.95;    // 0.8 - 1.2 rangos útiles para niños
  listeningUtterance.pitch = 1.0;

  try {
    speechSynthesis.speak(listeningUtterance);
  } catch(e) {
    if(onError) onError(e);
  }
}

function stopListeningPlayback() {
  try { speechSynthesis.cancel(); } catch(e){}
  listeningUtterance = null;
}

