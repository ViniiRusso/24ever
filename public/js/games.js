// public/js/games.js — COLE o arquivo inteiro

(function(){
  // Evita zoom por double-tap no iOS dentro da página de jogos
  let last = 0;
  document.addEventListener('touchend', (e)=>{
    const now = Date.now();
    if (now - last < 350) e.preventDefault();
    last = now;
  }, {passive:false});

  // 2048 (seu script existente usa window.Game2048; mantemos)
  const btn2048 = document.getElementById('btn2048');
  const c2048 = document.getElementById('game2048');
  const score2048 = document.getElementById('score2048');

  if (btn2048 && c2048 && window.Game2048){
    btn2048.addEventListener('click', ()=>{
      if (!window.Game2048.isRunning()){
        c2048.classList.remove('hidden');
        window.Game2048.start();
        btn2048.textContent = 'Reiniciar 2048';
      } else {
        window.Game2048.stop();
        window.Game2048.start();
      }
    }, {passive:true});

    document.querySelectorAll('[data-2048]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const dir = b.getAttribute('data-2048');
        window.Game2048.swipe(dir);
      }, {passive:true});
    });
  }

  // Tetris
  const btnTetris = document.getElementById('btnTetris');
  const pauseBtn  = document.getElementById('tPause');
  const tCanvas   = document.getElementById('tetris');
  const nextC     = document.getElementById('nextPiece');

  if (btnTetris && tCanvas && nextC){
    btnTetris.addEventListener('click', ()=>{
      tCanvas.classList.remove('hidden');
      nextC.classList.remove('hidden');
      if (window.initTetris) window.initTetris();
      pauseBtn?.classList.remove('hidden');
      btnTetris.textContent = 'Reiniciar Tetris';
    }, {passive:true});

    pauseBtn?.addEventListener('click', ()=>{
      if (window.togglePauseTetris) window.togglePauseTetris();
    }, {passive:true});

    // D-pad
    document.querySelectorAll('[data-t]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const act = b.getAttribute('data-t');
        if (window.ctrlTetris) window.ctrlTetris(act);
      }, {passive:true});
    });
  }
})();