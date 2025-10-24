// /js/games.js — integra UI com os engines 2048 e Tetris

// 2048
(function(){
  const btn = document.getElementById('btn2048');
  const canvas = document.getElementById('game2048');
  const scoreEl = document.getElementById('score2048');
  if (!btn || !canvas) return;

  let started = false;
  btn.addEventListener('click', () => {
    if (!started) {
      canvas.classList.remove('hidden');
      if (window.init2048) window.init2048(canvas, s => scoreEl.textContent = s);
      started = true;
      btn.textContent = 'Reiniciar 2048';
    } else {
      if (window.reset2048) window.reset2048();
    }
  }, {passive:true});

  // D-pad mobile 2048
  document.querySelectorAll('[data-2048]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const dir = b.getAttribute('data-2048');
      if (window.move2048) window.move2048(dir);
    }, {passive:true});
  });
})();

// Tetris
(function(){
  const btn = document.getElementById('btnTetris');
  const pauseBtn = document.getElementById('tPause');
  const canvas = document.getElementById('tetris');
  const next = document.getElementById('nextPiece');
  const scoreEl = document.getElementById('tScore');
  const levelEl = document.getElementById('tLevel');
  if (!btn || !canvas || !next) return;

  let started = false;
  btn.addEventListener('click', () => {
    if (!started) {
      canvas.classList.remove('hidden');
      next.classList.remove('hidden');
      if (window.initTetris) window.initTetris({
        canvas, preview: next,
        onScore: s => scoreEl.textContent = s,
        onLevel: l => levelEl.textContent = l
      });
      started = true;
      pauseBtn.classList.remove('hidden');
      btn.textContent = 'Reiniciar Tetris';
    } else {
      if (window.resetTetris) window.resetTetris();
    }
  }, {passive:true});

  pauseBtn?.addEventListener('click', ()=>{
    if (window.togglePauseTetris) window.togglePauseTetris();
  }, {passive:true});

  // D-pad mobile Tetris
  document.querySelectorAll('[data-t]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const act = b.getAttribute('data-t');
      if (window.ctrlTetris) window.ctrlTetris(act);
    }, {passive:true});
  });
})();