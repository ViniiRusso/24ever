// games.js — lazy init dos jogos + D-pad mobile + anti double-tap zoom
(function(){
  // anti double-tap zoom global na página de jogos
  let last = 0;
  document.addEventListener('touchend', (e)=>{
    const now = Date.now();
    if (now - last < 350) { e.preventDefault(); }
    last = now;
  }, {passive:false});

  // 2048
  const btn2048 = document.getElementById('btn2048');
  const c2048 = document.getElementById('game2048');
  const score2048 = document.getElementById('score2048');

  if (btn2048 && c2048) {
    let started = false;
    btn2048.addEventListener('click', () => {
      if (!started) {
        c2048.classList.remove('hidden');
        if (window.init2048) window.init2048(c2048, score => score2048.textContent = score);
        started = true;
        btn2048.textContent = 'Reiniciar 2048';
      } else {
        if (window.reset2048) window.reset2048();
      }
    }, {passive:true});

    // D-pad mobile
    document.querySelectorAll('[data-2048]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const dir = b.getAttribute('data-2048');
        if (window.move2048) window.move2048(dir);
      }, {passive:true});
    });
  }

  // Tetris
  const btnTetris = document.getElementById('btnTetris');
  const pauseBtn = document.getElementById('tPause');
  const tCanvas = document.getElementById('tetris');
  const nextCanvas = document.getElementById('nextPiece');
  const tScore = document.getElementById('tScore');
  const tLevel = document.getElementById('tLevel');

  if (btnTetris && tCanvas && nextCanvas) {
    let startedT = false;
    btnTetris.addEventListener('click', () => {
      if (!startedT) {
        tCanvas.classList.remove('hidden');
        nextCanvas.classList.remove('hidden');
        if (window.initTetris)
          window.initTetris({ canvas: tCanvas, preview: nextCanvas,
            onScore: s => tScore.textContent = s,
            onLevel: l => tLevel.textContent = l
          });
        startedT = true;
        pauseBtn.classList.remove('hidden');
        btnTetris.textContent = 'Reiniciar Tetris';
      } else {
        if (window.resetTetris) window.resetTetris();
      }
    }, {passive:true});

    pauseBtn?.addEventListener('click', ()=>{
      if (window.togglePauseTetris) window.togglePauseTetris();
    }, {passive:true});

    // D-pad mobile
    document.querySelectorAll('[data-t]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const act = b.getAttribute('data-t');
        if (window.ctrlTetris) window.ctrlTetris(act);
      }, {passive:true});
    });
  }
})();