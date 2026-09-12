'use strict';
function renderOrder(){
  const a = document.getElementById('answers');
  a.innerHTML = '';
  touchItems = [];

  const info = document.createElement('div');
  info.innerText = '👉 Arrastra para ordenar:';
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

  item.addEventListener('pointerdown', e=>{
    dragging = true;
    item.setPointerCapture?.(e.pointerId);
    item.classList.add('moving');
    e.preventDefault();
  });

  item.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const siblings = [...container.children].filter(c=>c!==item);
    const target = siblings.find(sib=>{
      const box = sib.getBoundingClientRect();
      return e.clientY >= box.top && e.clientY <= box.bottom;
    });
    if(!target) return;
    const box = target.getBoundingClientRect();
    container.insertBefore(item, e.clientY < box.top + box.height/2 ? target : target.nextSibling);
  });

  const stop = ()=>{
    dragging = false;
    item.classList.remove('moving');
  };
  item.addEventListener('pointerup', stop);
  item.addEventListener('pointercancel', stop);

  // Alternativa de teclado: Alt + flecha arriba/abajo.
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

