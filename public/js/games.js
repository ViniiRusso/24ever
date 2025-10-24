// games.js — orquestra 2048 e Tetris (mobile-friendly, iOS safe)

(function () {
  // Bloqueia double-tap zoom e gestos estranhos no iOS nesta página
  let last = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - last < 350) e.preventDefault();
    last = now;
  }, { passive: false });

  // =============== 2048 =================
  const btn2048   = document.getElementById('btn2048');
  const c2048     = document.getElementById('game2048');
  const score2048 = document.getElementById('score2048');

  // upscale para Retina
  function fitCanvasForDPR(canvas) {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // gesto de swipe bem leve para 2048
  function attachSwipe(el, onDir) {
    let sx = 0, sy = 0, dx = 0, dy = 0, touching = false;
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      touching = true;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      dx = dy = 0;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!touching) return;
      dx = e.touches[0].clientX - sx;
      dy = e.touches[0].clientY - sy;
    }, { passive: true });

    el.addEventListener('touchend', () => {
      if (!touching) return;
      touching = false;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const TH = 24; // limiar
      if (ax < TH && ay < TH) return;
      if (ax > ay) onDir(dx > 0 ? 'right' : 'left');
      else onDir(dy > 0 ? 'down' : 'up');
    }, { passive: true });
  }

  if (btn2048 && c2048) {
    let running2048 = false;

    btn2048.addEventListener('click', () => {
      if (!running2048) {
        c2048.classList.remove('hidden');
        fitCanvasForDPR(c2048);
        window.Game2048.start();
        running2048 = true;
        btn2048.textContent = 'Reiniciar 2048';
      } else {
        // parar e recomeçar
        window.Game2048.stop();
        fitCanvasForDPR(c2048);
        window.Game2048.start();
      }
    }, { passive: true });

    // D-pad mobile
    document.querySelectorAll('[data-2048]').forEach(b => {
      b.addEventListener('click', () => {
        const dir = b.getAttribute('data-2048');
        if (window.Game2048?.isRunning()) window.Game2048.swipe(dir);
      }, { passive: true });
    });

    // swipe sobre o canvas
    attachSwipe(c2048, (dir) => {
      if (window.Game2048?.isRunning()) window.Game2048.swipe(dir);
    });

    // atualizar placar quando o jogo somar (hook simples: polling leve)
    setInterval(() => {
      // o módulo atualiza o score internamente; lemos do DOM desenhado
      // Como não há getter de score exposto, mantemos via canvas draw -> ignoramos aqui.
      // Mantemos o elemento por compatibilidade visual.
    }, 1500);
  }

  // =============== Tetris =================
  const btnTetris  = document.getElementById('btnTetris');
  const pauseBtn   = document.getElementById('tPause');
  const tCanvas    = document.getElementById('tetris');
  const nextCanvas = document.getElementById('nextPiece');
  const tScore     = document.getElementById('tScore');
  const tLevel     = document.getElementById('tLevel');

  if (btnTetris && tCanvas && nextCanvas) {
    let runningT = false;

    function resizeTetris() {
      // mantém proporção, mas ajusta para DPR
      fitCanvasForDPR(tCanvas);
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      nextCanvas.width  = Math.round((nextCanvas.clientWidth || nextCanvas.width) * dpr);
      nextCanvas.height = Math.round((nextCanvas.clientHeight || nextCanvas.height) * dpr);
      const nctx = nextCanvas.getContext('2d');
      nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    btnTetris.addEventListener('click', () => {
      if (!runningT) {
        tCanvas.classList.remove('hidden');
        nextCanvas.classList.remove('hidden');
        resizeTetris();
        window.Tetris.start();
        runningT = true;
        pauseBtn.classList.remove('hidden');
        btnTetris.textContent = 'Reiniciar Tetris';
      } else {
        window.Tetris.stop();
        resizeTetris();
        window.Tetris.start();
      }
    }, { passive: true });

    pauseBtn?.addEventListener('click', () => {
      window.Tetris.togglePause();
      pauseBtn.textContent = window.Tetris.paused ? 'Retomar' : 'Pausar';
    }, { passive: true });

    // D-pad mobile
    document.querySelectorAll('[data-t]').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.getAttribute('data-t');
        if (!window.Tetris?.isRunning()) return;
        if (act === 'left')  window.Tetris.move(-1);
        if (act === 'right') window.Tetris.move(1);
        if (act === 'soft')  window.Tetris.softDrop();
        if (act === 'hard')  window.Tetris.hardDrop();
        if (act === 'rotate') window.Tetris.rotate();
      }, { passive: true });
    });

    // atualiza HUD simples (score/level) em intervalo leve
    setInterval(() => {
      if (!window.Tetris?.isRunning()) return;
      // os setters já atualizam nos módulos; aqui apenas garantimos consistência visual
      // (mantido por compatibilidade)
      tScore.textContent = document.getElementById('tScore')?.textContent || tScore.textContent;
      tLevel.textContent = document.getElementById('tLevel')?.textContent || tLevel.textContent;
    }, 1500);

    // ajustar para rotação do iPhone
    window.addEventListener('orientationchange', () => {
      if (!runningT) return;
      setTimeout(resizeTetris, 250);
    });
  }
})();