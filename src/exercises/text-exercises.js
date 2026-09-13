'use strict';
function renderCompletar(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  if (!current.opciones || !current.respuesta) {
    a.innerHTML = '<em>Error en los datos de la pregunta</em>';
    return;
  }

  // Frase con hueco
  const frase = document.createElement('div');
  frase.className = 'exercise-sentence';
  frase.innerHTML = current.pregunta.replace('___', '<strong>_____</strong>');
  a.appendChild(frase);

  // Opciones
  const opciones = shuffle(current.opciones.split('|')); // No menclarArray, que no existe

  opciones.forEach(op=>{
    const b = document.createElement('button');
    b.innerText = op;

    b.onclick = ()=>{
      const ok = normalize(op) === normalize(current.respuesta);
      finish(ok, b);
    };

    a.appendChild(b);
  });
}

function renderClasificar(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  let selectedItem = null;

  // Parsear categorías
  const categorias = current.respuesta.split('|').map(c => {
    const [nombre, items] = c.split(':');
    return {
      nombre,
      items: items.split(',').map(normalize),
      colocados: []
    };
  });

  // 🔧 Elementos salen de las categorías
  const elementos = shuffle(
    categorias.flatMap(c => c.items)
  );

  // Contenedor general
  const wrap = document.createElement('div');
  wrap.className = 'exercise-wrap';

  // Zona elementos
  const pool = document.createElement('div');
  pool.className = 'exercise-pool';
  pool.innerText = 'Elementos';

  elementos.forEach(txt=>{
    const el = document.createElement('div');
    el.innerText = txt;
    el.className = 'exercise-item';

    el.onclick = ()=>{
      if(questionLocked) return;
      selectedItem = el;
      highlight(el, pool);
    };

    pool.appendChild(el);
  });

  wrap.appendChild(pool);

  // Zonas de categorías
  categorias.forEach(cat=>{
    const box = document.createElement('div');
    box.className = 'category-box';

    const title = document.createElement('strong');
    title.innerText = cat.nombre;
    box.appendChild(title);

    box.onclick = ()=>{
      if(questionLocked || !selectedItem) return;

      const value = normalize(selectedItem.innerText);
      const correcta = cat.items.includes(value);

      if(correcta){
        selectedItem.classList.add('is-correct');
        box.appendChild(selectedItem);
        cat.colocados.push(value);

        registrarEvento("Acierto");
        visualAcierto(selectedItem);
      }else{
        const wrongItem = selectedItem;
        wrongItem.classList.add('is-wrong');
        setTimeout(()=> wrongItem.classList.remove('is-wrong'), 600);
        handleError(wrongItem);
      }

      selectedItem = null;

      const totalCorrectos = categorias.reduce((acc,c)=>acc+c.items.length,0);
      const colocados = categorias.reduce((acc,c)=>acc+c.colocados.length,0);

      if(colocados === totalCorrectos){
        handleCorrect(selectedItem);
      }
    };

    wrap.appendChild(box);
  });

  a.appendChild(wrap);
}

function renderNoEncaja(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  // Instrucción clara
  const info = document.createElement('div');
  info.innerText = '❓ ¿Cuál NO encaja?';
  info.className = 'exercise-info';
  a.appendChild(info);

  // Crear lista de opciones como botones (aleatorizadas)
  const opts = shuffle(current.opciones.split('|').map(s => s.trim()).filter(Boolean));
  opts.forEach(o=>{
    const b = document.createElement('button');
    b.innerText = o;

    // Al hacer clic comprobamos si esa opción es la que no encaja
    b.onclick = ()=> finish(normalize(o) === normalize(current.respuesta), b);

    a.appendChild(b);
  });

}

