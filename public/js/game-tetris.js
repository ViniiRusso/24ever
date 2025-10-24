// public/js/game-tetris.js
(function(){
  const tCanvas = document.getElementById('tetris');
  const nextCanvas = document.getElementById('nextPiece');
  if (!tCanvas || !nextCanvas) return;

  const scoreEl = document.getElementById('tScore');
  const levelEl = document.getElementById('tLevel');

  // constantes do jogo
  const COLS = 10, ROWS = 20, CELL = 24;
  const SHAPES = {
    I:[[1,1,1,1]], J:[[1,0,0],[1,1,1]], L:[[0,0,1],[1,1,1]],
    O:[[1,1],[1,1]], S:[[0,1,1],[1,1,0]], Z:[[1,1,0],[0,1,1]], T:[[0,1,0],[1,1,1]]
  };
  const COLORS = ['#000','#fda4af','#f9a8d4','#a78bfa','#93c5fd','#86efac','#fcd34d','#fbbf24'];

  let DPR = Math.max(1, window.devicePixelRatio || 1);
  let ctx, nctx, rafId=null, resizeObs;

  // estado
  let board, piece, next;
  let score, level, lines;
  let dropMs, lastTs, acc;

  function cssPx(el){ return el.getBoundingClientRect ? el.getBoundingClientRect() : {width: el.clientWidth, height: el.clientHeight}; }

  function setupCanvas(cnv, w, h){
    // define tamanho visual
    cnv.style.width  = w + 'px';
    cnv.style.height = h + 'px';
    // define buffer
    cnv.width  = Math.round(w * DPR);
    cnv.height = Math.round(h * DPR);
    const c2d = cnv.getContext('2d');
    c2d.setTransform(DPR, 0, 0, DPR, 0, 0);
    return c2d;
  }

  function sizeFromLayout(){
    // tenta pegar a largura do contêiner pai; se falhar, usa largura fixa
    const wrap = tCanvas.parentElement;
    let w = (wrap ? cssPx(wrap).width : 0) | 0;
    if (!w || w < COLS*CELL) w = COLS * CELL; // fallback
    const h = ROWS * CELL;
    return { w, h };
  }

  function ensureContexts(){
    // tira hidden (por conferência extra)
    tCanvas.classList.remove('hidden');
    nextCanvas.classList.remove('hidden');

    const { w, h } = sizeFromLayout();
    ctx  = setupCanvas(tCanvas,  w, h);
    nctx = setupCanvas(nextCanvas, 96, 96);
  }

  function resetState(){
    board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
    piece = null; next = rndPiece();

    score = 0; level = 1; lines = 0;
    dropMs = 700; lastTs = 0; acc = 0;

    if (scoreEl) scoreEl.textContent = '0';
    if (levelEl) levelEl.textContent = '1';
  }

  function rndPiece(){
    const keys = Object.keys(SHAPES);
    const k = keys[(Math.random()*keys.length)|0];
    return { m: SHAPES[k].map(r=>r.slice()), x: 3, y: 0, c: 1+((Math.random()*6)|0) };
  }

  function drawHeart(c2d, x, y, color, size=CELL){
    c2d.fillStyle = color;
    const bx = x*size, by = y*size;
    c2d.beginPath();
    c2d.moveTo(bx+size/2, by+size*0.75);
    c2d.bezierCurveTo(bx+size*1.2, by+size*0.2, bx+size*0.8, by, bx+size/2, by+size*0.35);
    c2d.bezierCurveTo(bx+size*0.2, by, bx-size*0.2, by+size*0.2, bx+size/2, by+size*0.75);
    c2d.fill();
  }

  function drawNext(){
    nctx.clearRect(0,0,nextCanvas.width, nextCanvas.height);
    const m = next.m;
    const cw = nextCanvas.clientWidth, ch = nextCanvas.clientHeight;
    const px = Math.floor((cw - m[0].length*CELL/2)/2);
    const py = Math.floor((ch - m.length*CELL/2)/2);
    nctx.save(); nctx.translate(px,py);
    for (let y=0;y<m.length;y++) for (let x=0;x<m[y].length;x++)
      if (m[y][x]) drawHeart(nctx, x, y, COLORS[next.c], CELL/2);
    nctx.restore();
  }

  function rotate(mat){
    const N=mat.length, M=mat[0].length;
    const r=Array.from({length:M},()=>Array(N).fill(0));
    for (let y=0;y<N;y++) for (let x=0;x<M;x++) r[x][N-1-y]=mat[y][x];
    return r;
  }

  function collide(px=piece.x, py=piece.y, pm=piece.m){
    for (let y=0;y<pm.length;y++){
      for (let x=0;x<pm[y].length;x++){
        if (!pm[y][x]) continue;
        const nx = px+x, ny = py+y;
        if (nx<0 || nx>=COLS || ny>=ROWS) return true;
        if (ny>=0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function merge(){
    for (let y=0;y<piece.m.length;y++)
      for (let x=0;x<piece.m[y].length;x++)
        if (piece.m[y][x]) board[piece.y+y][piece.x+x]=piece.c;
  }

  function clearLines(){
    let cleared=0;
    for (let y=ROWS-1;y>=0;y--){
      if (board[y].every(Boolean)){
        board.splice(y,1);
        board.unshift(Array(COLS).fill(0));
        y++; cleared++;
      }
    }
    if (cleared){
      lines+=cleared; score+=cleared*100*level;
      if (lines>=level*5){ level++; dropMs=Math.max(120, dropMs-60); }
      if (scoreEl) scoreEl.textContent=String(score);
      if (levelEl) levelEl.textContent=String(level);
    }
  }

  function spawn(){
    piece = next || rndPiece();
    next = rndPiece();
    drawNext();
    if (collide()){ // game over → recomeça
      resetState();
      spawn();
    }
  }

  function ghostY(){
    let y=piece.y;
    while(!collide(piece.x, y+1)) y++;
    return y;
  }

  function render(){
    const cw = tCanvas.clientWidth, ch = tCanvas.clientHeight;
    ctx.clearRect(0,0,cw,ch);
    ctx.fillStyle='#fffafc';
    ctx.fillRect(0,0,cw,ch);

    // board
    for (let y=0;y<ROWS;y++)
      for (let x=0;x<COLS;x++)
        if (board[y][x]) drawHeart(ctx, x, y, COLORS[board[y][x]]);

    // ghost
    const gy=ghostY();
    for (let y=0;y<piece.m.length;y++)
      for (let x=0;x<piece.m[y].length;x++)
        if (piece.m[y][x]){ ctx.globalAlpha=.2; drawHeart(ctx, x+piece.x, y+gy, COLORS[piece.c]); ctx.globalAlpha=1; }

    // peça
    for (let y=0;y<piece.m.length;y++)
      for (let x=0;x<piece.m[y].length;x++)
        if (piece.m[y][x]) drawHeart(ctx, x+piece.x, y+piece.y, COLORS[piece.c]);
  }

  function step(ts){
    if (!rafId) return;
    const dt = ts - (lastTs || ts);
    lastTs = ts; acc += dt;
    if (acc >= dropMs){
      acc = 0;
      piece.y++;
      if (collide()){
        piece.y--;
        merge(); clearLines(); spawn();
      }
    }
    render();
    rafId = requestAnimationFrame(step);
  }

  function move(dx){
    const nx = piece.x + dx;
    if (!collide(nx, piece.y)) piece.x = nx;
  }
  function soft(){
    if (!collide(piece.x, piece.y+1)){ piece.y++; acc=0; }
    else { merge(); clearLines(); spawn(); acc=0; }
  }
  function hard(){
    while(!collide(piece.x, piece.y+1)) piece.y++;
    merge(); clearLines(); spawn(); acc=0;
  }
  function rot(){
    const r = rotate(piece.m);
    if (!collide(piece.x, piece.y, r)) piece.m = r;
    else if (!collide(piece.x-1, piece.y, r)) { piece.x--; piece.m=r; }
    else if (!collide(piece.x+1, piece.y, r)) { piece.x++; piece.m=r; }
  }

  function start(){
    // 1) contextos
    ensureContexts();

    // 2) estado
    resetState();
    spawn();

    // 3) ⚠️ Render imediato (iOS às vezes demora pro primeiro RAF)
    render();

    // 4) loop
    if (!rafId){ lastTs=0; rafId = requestAnimationFrame(step); }

    // 5) reconfigura em resize/orientation
    try{
      resizeObs?.disconnect();
      resizeObs = new ResizeObserver(()=>{
        DPR = Math.max(1, window.devicePixelRatio || 1);
        ensureContexts();
        render();
      });
      resizeObs.observe(tCanvas.parentElement || tCanvas);
    }catch(_){}
  }

  function stop(){ if (rafId){ cancelAnimationFrame(rafId); rafId=null; } }

  // Expor para games.js / botões
  window.initTetris = start;
  window.resetTetris = () => { stop(); start(); };
  window.togglePauseTetris = () => {
    if (rafId){ cancelAnimationFrame(rafId); rafId=null; }
    else { lastTs=0; rafId=requestAnimationFrame(step); }
  };
  window.ctrlTetris = (act)=>{
    if (!rafId) return;
    if (act==='left') move(-1);
    if (act==='right') move(1);
    if (act==='soft') soft();
    if (act==='hard') hard();
    if (act==='rotate') rot();
  };
})();