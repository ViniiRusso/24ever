// game-tetris.js — Tetris compatível com iPhone (corrige tamanho do canvas / DPR)
window.Tetris = (function () {
  const tCanvas = document.getElementById('tetris');
  const nextEl  = document.getElementById('nextPiece');
  const scoreEl = document.getElementById('tScore');
  const levelEl = document.getElementById('tLevel');

  if (!tCanvas || !nextEl) {
    console.warn('⚠️ Tetris: canvas não encontrado.');
    return { start(){}, stop(){}, isRunning(){ return false; }, togglePause(){} };
  }

  const ctx     = tCanvas.getContext('2d', { alpha: false });
  const nextCtx = nextEl.getContext('2d', { alpha: false });

  const COLS = 10, ROWS = 20;
  const SHAPES = {
    I:[[1,1,1,1]], J:[[1,0,0],[1,1,1]], L:[[0,0,1],[1,1,1]],
    O:[[1,1],[1,1]], S:[[0,1,1],[1,1,0]], Z:[[1,1,0],[0,1,1]], T:[[0,1,0],[1,1,1]]
  };
  const COLORS = ['#000','#fda4af','#f9a8d4','#a78bfa','#93c5fd','#86efac','#fcd34d','#fbbf24'];

  let board, piece, next, raf=null, last=0, dropCounter=0, dropInterval=600;
  let score=0, level=1, lines=0;

  // ---------- RESIZE: ajusta backing store para iOS/Safari ----------
  function resizeCanvases() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // tamanho “visível” (CSS)
    const w = tCanvas.clientWidth  || 240;
    const h = tCanvas.clientHeight || 480;

    // define tamanho interno (backing store)
    tCanvas.width  = Math.round(w * dpr);
    tCanvas.height = Math.round(h * dpr);

    // preview (quadrado ~96px no HTML; usa tamanho real para retina)
    const pw = nextEl.clientWidth  || 96;
    const ph = nextEl.clientHeight || 96;
    nextEl.width  = Math.round(pw * dpr);
    nextEl.height = Math.round(ph * dpr);

    // seta matriz de transformação para desenhar em “pixels CSS”
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // garante resize inicial e nas mudanças de orientação
  const ro = new ResizeObserver(resizeCanvases);
  ro.observe(tCanvas);
  ro.observe(nextEl);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvases, 120), { passive: true });

  // ---------- helpers do jogo ----------
  const keys = Object.keys(SHAPES);
  const rndPiece = () => ({ m: SHAPES[keys[(Math.random()*keys.length)|0]].map(r=>r.slice()), x:3, y:0, c: 1+((Math.random()*6)|0) });

  function reset(){
    board = Array.from({length: ROWS}, ()=>Array(COLS).fill(0));
    piece = null; next = rndPiece();
    dropCounter = 0; dropInterval = 600; last = 0;
    score = 0; level = 1; lines = 0;
    if (scoreEl) scoreEl.textContent = score;
    if (levelEl) levelEl.textContent = level;
  }

  function drawHeart(c2d, x, y, c, bs){
    const bx = x*bs, by = y*bs;
    c2d.fillStyle = COLORS[c];
    c2d.beginPath();
    c2d.moveTo(bx+bs/2, by+bs*0.75);
    c2d.bezierCurveTo(bx+bs*1.2, by+bs*0.2, bx+bs*0.8, by, bx+bs/2, by+bs*0.35);
    c2d.bezierCurveTo(bx+bs*0.2, by, bx-bs*0.2, by+bs*0.2, bx+bs/2, by+bs*0.75);
    c2d.fill();
  }

  function drawNext(){
    if (!next) return;
    nextCtx.clearRect(0,0,nextEl.width, nextEl.height);
    // usa pixels CSS (transform já aplicado pelo resizeCanvases)
    const pw = nextEl.clientWidth, ph = nextEl.clientHeight;
    const bs = Math.floor(Math.min(pw, ph) / 8); // tamanho base das mini peças
    const m = next.m;
    const offx = Math.floor((pw - m[0].length*bs)/2);
    const offy = Math.floor((ph - m.length*bs)/2);
    nextCtx.save();
    nextCtx.translate(offx, offy);
    for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++) if(m[y][x]) drawHeart(nextCtx, x, y, next.c, bs);
    nextCtx.restore();
  }

  const rotate = m => m[0].map((_,i)=>m.map(r=>r[i]).reverse());
  const collide = () => piece.m.some((r,yy)=>r.some((v,xx)=> v && (board[yy+piece.y]?.[xx+piece.x] ?? 1)));
  const merge   = () => piece.m.forEach((r,yy)=>r.forEach((v,xx)=>{ if(v) board[yy+piece.y][xx+piece.x]=piece.c; }));
  function clearLines(){
    let cleared=0;
    for(let y=ROWS-1;y>=0;y--){
      if (board[y].every(v=>v)){ board.splice(y,1); board.unshift(Array(COLS).fill(0)); y++; cleared++; }
    }
    if (cleared){
      lines+=cleared; score+=cleared*100*level;
      if (lines >= level*5){ level++; dropInterval = Math.max(120, dropInterval-60); }
      if (scoreEl) scoreEl.textContent = score;
      if (levelEl) levelEl.textContent = level;
    }
  }

  function newPiece(){
    piece = next || rndPiece();
    next = rndPiece();
    drawNext();
    if (collide()){ reset(); newPiece(); }
  }

  function draw(){
    const w = tCanvas.clientWidth, h = tCanvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#fffafc';
    ctx.fillRect(0,0,w,h);

    const bs = Math.floor(Math.min(w/COLS, h/ROWS)); // tamanho da célula
    // tabuleiro
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(board[y][x]) drawHeart(ctx, x, y, board[y][x], bs);
    // peça
    for(let y=0;y<piece.m.length;y++) for(let x=0;x<piece.m[y].length;x++) if(piece.m[y][x]) drawHeart(ctx, x+piece.x, y+piece.y, piece.c, bs);
  }

  function update(t=0){
    const d = t - last; last = t;
    if (!Tetris.paused){
      dropCounter += d;
      if (dropCounter > dropInterval){
        piece.y++;
        if (collide()){ piece.y--; merge(); clearLines(); newPiece(); }
        dropCounter = 0;
      }
    }
    draw();
    raf = requestAnimationFrame(update);
  }

  function move(dx){ piece.x+=dx; if (collide()) piece.x-=dx; }
  function softDrop(){ piece.y++; if(collide()){ piece.y--; merge(); clearLines(); newPiece(); dropCounter=0; } }
  function hardDrop(){ while(!collide()){ piece.y++; } piece.y--; merge(); clearLines(); newPiece(); dropCounter=0; }
  function rotatePiece(){ const r=rotate(piece.m); const old=piece.m; piece.m=r; if (collide()) piece.m=old; }

  function onKey(e){
    if (!raf) return;
    const k = e.key;
    if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(k)) e.preventDefault();
    if (k==='ArrowLeft')  move(-1);
    if (k==='ArrowRight') move(1);
    if (k==='ArrowDown')  softDrop();
    if (k===' ')          hardDrop();
    if (k==='ArrowUp')    rotatePiece();
  }

  const Tetris = {
    paused:false,
    start(){
      resizeCanvases();
      reset(); newPiece(); drawNext();
      if (!raf) raf = requestAnimationFrame(update);
      window.addEventListener('keydown', onKey, { passive:false });
    },
    stop(){
      if (raf){ cancelAnimationFrame(raf); raf=null; }
      window.removeEventListener('keydown', onKey);
      this.paused=false;
    },
    togglePause(){ this.paused = !this.paused; },
    isRunning(){ return !!raf; },
    move, softDrop, hardDrop, rotate: rotatePiece
  };

  return Tetris;
})();