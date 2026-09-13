'use strict';
function renderOrder(){
  const a = document.getElementById('answers');
  a.innerHTML = '';
  touchItems = [];

  const info = document.createElement('div');
  info.innerText = '👉 Arrastra las palabras o toca una y después otra para moverla:';
  info.className = 'exercise-info';
  a.appendChild(info);

  const list = document.createElement('div');
  list.id = 'orderList';
  list.className = 'order-list';

  const items = shuffle(current.opciones.split('|').slice());
  items.forEach(text=>{
    const el = document.createElement('div');
    el.innerText = text;
    el.className = 'order-item';
    el.tabIndex = 0;
    enablePointerReorder(el, list);
    list.appendChild(el);
    touchItems.push(el);
  });

  a.appendChild(list);

  const resetBtn = document.createElement('button');
  resetBtn.innerText = '🔄 Empezar de nuevo';
  resetBtn.onclick = renderOrder;
  a.appendChild(resetBtn);

  const checkBtn = document.createElement('button');
  checkBtn.innerText = '✅ Comprobar';
  checkBtn.className = 'primary-btn';
  checkBtn.onclick = () => checkOrderTouch(checkBtn);
  a.appendChild(checkBtn);
}

function enablePointerReorder(item, container){
  let dragging = false;
  let startY = 0;
  let moved = false;

  const moveToPointer = clientY => {
    const siblings = [...container.querySelectorAll('.order-item')].filter(c => c !== item);
    if (!siblings.length) return;

    // Busca el primer elemento cuyo centro esté por debajo del dedo.
    const before = siblings.find(sib => {
      const box = sib.getBoundingClientRect();
      return clientY < box.top + box.height / 2;
    });
    if (before) container.insertBefore(item, before);
    else container.appendChild(item);
  };

  item.addEventListener('pointerdown', e=>{
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    moved = false;
    startY = e.clientY;
    item.classList.add('moving');
    item.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });

  item.addEventListener('pointermove', e=>{
    if(!dragging) return;
    if (Math.abs(e.clientY - startY) > 6) moved = true;
    moveToPointer(e.clientY);
    e.preventDefault();
  });

  const stop = e=>{
    if(!dragging) return;
    dragging = false;
    item.classList.remove('moving');
    try { item.releasePointerCapture?.(e.pointerId); } catch (_) {}
    e.preventDefault();
  };
  item.addEventListener('pointerup', stop);
  item.addEventListener('pointercancel', stop);

  // En móvil, un toque también sirve: selecciona una palabra y después
  // toca otra para colocar la primera justo antes. Es un respaldo fiable
  // para Safari/navegadores donde el arrastre táctil puede ser irregular.
  item.addEventListener('click', e=>{
    if (moved) { moved = false; return; }
    const selected = container.querySelector('.order-item.tap-selected');
    if (!selected) {
      item.classList.add('tap-selected');
      item.setAttribute('aria-pressed', 'true');
      return;
    }
    selected.classList.remove('tap-selected');
    selected.removeAttribute('aria-pressed');
    if (selected !== item) container.insertBefore(selected, item);
  });

  // Teclado: Alt + flecha arriba/abajo.
  item.addEventListener('keydown', e=>{
    if(!e.altKey || !['ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    if(e.key === 'ArrowUp' && item.previousElementSibling){
      container.insertBefore(item, item.previousElementSibling);
    } else if(e.key === 'ArrowDown' && item.nextElementSibling){
      container.insertBefore(item.nextElementSibling, item);
    }
    item.focus();
  });
}
function checkOrderTouch(targetBtn = null){
  const items = [...document.querySelectorAll('#orderList .order-item')].map(d=>normalize(d.innerText));
  const correct = current.respuesta.split('|').map(normalize);
  const ok = JSON.stringify(items) === JSON.stringify(correct);
  ok ? handleCorrect(targetBtn) : handleError(targetBtn);
}

function renderDrag(){
  const a = document.getElementById('answers');
  a.innerHTML = '';
  selectedLeft = null;

  const left = current.opciones.split('|');
  const answers = current.respuesta.split('|');
  const right = shuffle(answers.slice());

  const info = document.createElement('div');
  info.className = 'exercise-info';
  info.innerText = '🔗 Elige un elemento de cada columna para emparejarlos';
  a.appendChild(info);

  const wrap = document.createElement('div');
  wrap.className = 'match-wrap';
  const L = document.createElement('div');
  const R = document.createElement('div');
  L.className = R.className = 'match-column';

  left.forEach((text, index)=>{
    const d = document.createElement('div');
    d.innerText = text;
    d.className = 'match-item';
    d.tabIndex = 0;
    d.dataset.index = index;
    const select = ()=>{
      if(d.classList.contains('used')) return;
      L.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
      selectedLeft = d;
      d.classList.add('highlight');
    };
    d.onclick = select;
    d.onkeydown = e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); select(); } };
    L.appendChild(d);
  });

  right.forEach(text=>{
    const d = document.createElement('div');
    d.innerText = text;
    d.className = 'match-item';
    d.tabIndex = 0;
    const choose = ()=>{
      if(!selectedLeft || d.classList.contains('used')) return;
      const i = Number(selectedLeft.dataset.index);
      const correct = normalize(answers[i]) === normalize(text);

      if(correct){
        selectedLeft.classList.add('used', 'is-correct');
        d.classList.add('used', 'is-correct');
        visualAcierto(d);
      } else {
        visualError(d);
        d.classList.add('is-wrong');
        setTimeout(()=>d.classList.remove('is-wrong'), 600);
      }
      selectedLeft.classList.remove('highlight');
      selectedLeft = null;

      const done = L.querySelectorAll('.used').length;
      if(done === left.length) handleCorrect(null);
    };
    d.onclick = choose;
    d.onkeydown = e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); choose(); } };
    R.appendChild(d);
  });

  wrap.appendChild(L);
  wrap.appendChild(R);
  a.appendChild(wrap);
}

