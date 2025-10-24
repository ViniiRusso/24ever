// Tetris — compatível com iOS/Safari, com os mesmos hooks usados no seu games.html
(function(){
  const BS = 24, COLS = 10, ROWS = 20;
  const colors=['#000','#fda4af','#f9a8d4','#a78bfa','#93c5fd','#86efac','#fcd34d','#fbbf24'];
  const shapes={
    I:[[1,1,1,1]],
    J:[[1,0,0],[1,1,1]],
    L:[[0,0,1],[1,1,1]],
    O:[[1,1],[1,1]],
    S:[[0,1,1],[1,1,0]],
    Z:[[1,1,0],[0,1,1]],
    T:[[0,1,0],[1,1,1]],
  };
  const keys = Object.keys(shapes);

  let canvas, ctx, nextCanvas, nextCtx;
  let board, piece, next, rafId=null, last=0, dropCounter=0, dropInterval=600;
  let score=0, level=1, lines=0, paused=false;
  let onScore=()=>{}, onLevel=()=>{};

  function rndPiece(){
    const k = keys[(Math.random()*keys.length)|0];
    return { m: shapes[k].map(r=>r.slice()), x:3, y:0, c: 1+((Math.random()*6)|0) };
  }

  function reset(){
    board = Array.from({length: ROWS},()=>Array(COLS).fill(0));
    piece = null;
    next = rndPiece();
    score = 0; level = 1; lines = 0;
    dropInterval = 600; dropCounter = 0;
    onScore(score); onLevel(level);
    clearCanvas();
    drawNext();
  }

  function clearCanvas(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fffafc';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    nextCtx.fillStyle='#fff';
    nextCtx.fillRect(0,0,nextCanvas.width,nextCanvas.height);
  }

  function drawHeartAt(c2d,x,y,c,bs=BS){
    c2d.fillStyle = colors[c];
    c2d.beginPath();
    const bx=x*bs, by=y*bs;
    c2d.moveTo(bx+bs/2, by+bs*0.75);
    c2d.bezierCurveTo(bx+bs*1.2, by+bs*0.2, bx+bs*0.8, by, bx+bs/2, by+bs*0.35);
    c2d.bezierCurveTo(bx+bs*0.2, by, bx-bs*0.2, by+bs*0.2, bx+bs/2, by+bs*0.75);
    c2d.fill();
  }

  function drawBoard(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fffafc';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // desenho do tabuleiro
    for(let y=0;y<ROWS;y++)
      for(let x=0;x<COLS;x++)
        if(board[y][x]) drawHeartAt(ctx,x,y,board[y][x]);

    // peça "fantasma"
    if (piece){
      let gy = piece.y;
      while(!collideAt(piece.m, piece.x, gy+1)) gy++;
      for(let y=0;y<piece.m.length;y++)
        for(let x=0;x<piece.m[y].length;x++)
          if(piece.m[y][x]){ ctx.globalAlpha=.18; drawHeartAt(ctx, x+piece.x, y+gy, piece.c); ctx.globalAlpha=1; }
    }

    // peça atual
    if (piece){
      for(let y=0;y<piece.m.length;y++)
        for(let x=0;x<piece.m[y].length;x++)
          if(piece.m[y][x]) drawHeartAt(ctx, x+piece.x, y+piece.y, piece.c);
    }
  }

  function drawNext(){
    nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    const m=next.m;
    const bs = BS/2;
    const offx=(nextCanvas.width  - m[0].length*bs)/2;
    const offy=(nextCanvas.height - m.length*bs)/2;
    nextCtx.save(); nextCtx.translate(offx,offy);
    for(let y=0;y<m.length;y++)
      for(let x=0;x<m[y].length;x++)
        if(m[y][x]) drawHeartAt(nextCtx,x,y,next.c,bs);
    nextCtx.restore();
  }

  function rotate(m){
    const N=m.length,M=m[0].length;
    const r=Array.from({length:M},()=>Array(N).fill(0));
    for(let y=0;y<N;y++) for(let x=0;x<M;x++) r[x][N-1-y]=m[y][x];
    return r;
  }

  function collideAt(m, px, py){
    for(let y=0;y<m.length;y++)
      for(let x=0;x<m[y].length;x++)
        if(m[y][x] && (board[py+y]?.[px+x] ?? 1)) return true;
    return false;
  }

  function merge(){
    for(let y=0;y<piece.m.length;y++)
      for(let x=0;x<piece.m[y].length;x++)
        if(piece.m[y][x]) board[piece.y+y][piece.x+x]=piece.c;
  }

  function clearLines(){
    let cleared=0;
    for(let y=ROWS-1;y>=0;y--){
      if(board[y].every(v=>v)){ board.splice(y,1); board.unshift(Array(COLS).fill(0)); y++; cleared++; }
    }
    if (cleared){
      lines+=cleared;
      score+=cleared*100*level;
      if(lines>=level*5){ level++; dropInterval=Math.max(120, dropInterval-60); onLevel(level); }
      onScore(score);
    }
  }

  function spawn(){
    piece = next || rndPiece();
    next = rndPiece();
    drawNext();
    if (collideAt(piece.m, piece.x, piece.y)){
      // game over -> reset suave
      reset();
      spawn();
    }
  }

  function update(t=0){
    const d = t - last; last = t;
    if (!paused){
      dropCounter += d;
      if (dropCounter > dropInterval){
        softDrop();
        dropCounter = 0;
      }
      drawBoard();
    }
    rafId = requestAnimationFrame(update);
  }

  function move(dx){
    if (!piece) return;
    const px = piece.x + dx;
    if (!collideAt(piece.m, px, piece.y)) piece.x = px;
  }

  function softDrop(){
    if (!piece) return;
    const py = piece.y + 1;
    if (collideAt(piece.m, piece.x, py)){
      merge();
      clearLines();
      spawn();
    } else {
      piece.y = py;
    }
  }

  function hardDrop(){
    if (!piece) return;
    while(!collideAt(piece.m, piece.x, piece.y+1)) piece.y++;
    merge(); clearLines(); spawn(); dropCounter=0;
  }

  function rotateAct(){
    if (!piece) return;
    const old = piece.m;
    const r = rotate(old);
    // pequenas correções de parede (wall-kick simples)
    if (!collideAt(r, piece.x, piece.y)) piece.m = r;
    else if (!collideAt(r, piece.x-1, piece.y)) { piece.x--; piece.m = r; }
    else if (!collideAt(r, piece.x+1, piece.y)) { piece.x++; piece.m = r; }
  }

  // API pública esperada pelo seu games.html
  window.initTetris = function initTetris(opts){
    canvas = opts.canvas;
    nextCanvas = opts.preview;
    onScore = typeof opts.onScore === 'function' ? opts.onScore : ()=>{};
    onLevel = typeof opts.onLevel === 'function' ? opts.onLevel : ()=>{};

    ctx = canvas.getContext('2d', { alpha:false, desynchronized:true });
    nextCtx = nextCanvas.getContext('2d', { alpha:false, desynchronized:true });

    // tamanhos fixos já estão no HTML, mas garantimos
    canvas.width = COLS*BS; canvas.height = ROWS*BS;
    nextCanvas.width = 96; nextCanvas.height = 96;

    // iOS: evita zoom por duplo toque dentro da área do jogo
    canvas.addEventListener('touchend', (e)=>{
      const now = Date.now();
      if (canvas._lt && now - canvas._lt < 350) e.preventDefault();
      canvas._lt = now;
    }, {passive:false});

    reset(); spawn();
    if (!rafId) rafId = requestAnimationFrame(update);
  };

  window.resetTetris = function(){
    reset(); spawn();
  };

  window.togglePauseTetris = function(){
    paused = !paused;
  };

  // D-pad / controles
  window.ctrlTetris = function(action){
    if (!piece) return;
    switch(action){
      case 'left':  move(-1); break;
      case 'right': move(1);  break;
      case 'soft':  softDrop(); break;
      case 'hard':  hardDrop(); break;
      case 'rotate': rotateAct(); break;
    }
  };

  // fallback de teclado (desktop)
  function onKey(e){
    if (!rafId) return;
    const k = e.key;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(k)) e.preventDefault();
    if (k==='ArrowLeft') move(-1);
    if (k==='ArrowRight') move(1);
    if (k==='ArrowDown') softDrop();
    if (k===' ') hardDrop();
    if (k==='ArrowUp') rotateAct();
  }
  window.addEventListener('keydown', onKey);
})();