// game-tetris.js — expõe a mesma API usada pelo games.js:
// window.initTetris({ canvas, preview, onScore, onLevel })
// window.resetTetris()
// window.togglePauseTetris()
// window.ctrlTetris(action: 'left'|'right'|'soft'|'hard'|'rotate')

(function(){
  let cfg = null;
  let ctx, pctx;          // canvas principal e preview
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  const COLS=10, ROWS=20, BS=24; // BS é base lógica; escala no DPR
  const colors=['#000','#fda4af','#f9a8d4','#a78bfa','#93c5fd','#86efac','#fcd34d','#fbbf24'];
  const shapes={ I:[[1,1,1,1]], J:[[1,0,0],[1,1,1]], L:[[0,0,1],[1,1,1]], O:[[1,1],[1,1]],
                 S:[[0,1,1],[1,1,0]], Z:[[1,1,0],[0,1,1]], T:[[0,1,0],[1,1,1]] };

  let board, piece, next, dropCounter, dropInterval, lastTs, score, level, lines, rafId=null;
  let paused=false;

  const keys=Object.keys(shapes);
  const rndPiece=()=>({ m: shapes[keys[(Math.random()*keys.length)|0]].map(r=>r.slice()), x:3, y:0, c: 1+((Math.random()*6)|0) });

  function setupCanvas(el, w, h){
    el.width = Math.floor(w * dpr);
    el.height= Math.floor(h * dpr);
    el.style.width = w + 'px';
    el.style.height= h + 'px';
    const c = el.getContext('2d');
    c.setTransform(dpr,0,0,dpr,0,0);
    return c;
  }

  function reset(){
    board = Array.from({length: ROWS},()=>Array(COLS).fill(0));
    piece=null; next=rndPiece();
    dropCounter=0; dropInterval=600; lastTs=0;
    score=0; level=1; lines=0;
    cfg?.onScore?.(score); cfg?.onLevel?.(level);
    if (pctx) { pctx.clearRect(0,0,cfg.preview.width, cfg.preview.height); }
  }

  function drawHeartAt(c2d,x,y,c,bs){
    const bx=x*bs, by=y*bs;
    c2d.fillStyle=colors[c];
    c2d.beginPath();
    c2d.moveTo(bx+bs/2, by+bs*0.75);
    c2d.bezierCurveTo(bx+bs*1.2, by+bs*0.2, bx+bs*0.8, by, bx+bs/2, by+bs*0.35);
    c2d.bezierCurveTo(bx+bs*0.2, by, bx-bs*0.2, by+bs*0.2, bx+bs/2, by+bs*0.75);
    c2d.fill();
  }

  function drawNext(){
    const w=96, h=96;
    pctx.clearRect(0,0,w,h);
    const m=next.m, bs=BS/2;
    const offx=(w - m[0].length*bs)/2, offy=(h - m.length*bs)/2;
    pctx.save(); pctx.translate(offx,offy);
    for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++)
      if(m[y][x]) drawHeartAt(pctx,x,y,next.c,bs);
    pctx.restore();
  }

  function rotate(m){ const N=m.length,M=m[0].length; const r=Array.from({length:M},()=>Array(N).fill(0)); for(let y=0;y<N;y++) for(let x=0;x<M;x++) r[x][N-1-y]=m[y][x]; return r; }
  function collide(px=piece.x, py=piece.y, m=piece.m){
    for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++)
      if(m[y][x] && (board[y+py]?.[x+px] ?? 1)) return true;
    return false;
  }
  function merge(){ for(let y=0;y<piece.m.length;y++) for(let x=0;x<piece.m[y].length;x++) if(piece.m[y][x]) board[y+piece.y][x+piece.x]=piece.c; }
  function clearLines(){
    let cleared=0;
    for(let y=ROWS-1;y>=0;y--){
      if(board[y].every(v=>v)){ board.splice(y,1); board.unshift(Array(COLS).fill(0)); y++; cleared++; }
    }
    if(cleared){
      lines+=cleared; score+=cleared*100*level;
      if(lines>=level*5){ level++; dropInterval=Math.max(120, dropInterval-60); }
      cfg?.onScore?.(score); cfg?.onLevel?.(level);
    }
  }
  function ghostY(){
    let y=piece.y;
    while(true){ y++; if (collide(piece.x, y)) return y-1; }
  }

  function draw(){
    const W=cfg.canvas.width/dpr, H=cfg.canvas.height/dpr;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#fffafc';
    ctx.fillRect(0,0,W,H);

    // ghost
    const gy=ghostY();
    for(let y=0;y<piece.m.length;y++) for(let x=0;x<piece.m[y].length;x++)
      if(piece.m[y][x]){ ctx.globalAlpha=.2; drawHeartAt(ctx, x+piece.x, y+gy, piece.c, BS); }
    ctx.globalAlpha=1;

    // board
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++)
      if(board[y][x]) drawHeartAt(ctx,x,y,board[y][x],BS);

    // piece
    for(let y=0;y<piece.m.length;y++) for(let x=0;x<piece.m[y].length;x++)
      if(piece.m[y][x]) drawHeartAt(ctx,x+piece.x,y+piece.y,piece.c,BS);
  }

  function update(ts=0){
    const dt = ts - lastTs; lastTs = ts;
    if (!paused){
      dropCounter += dt;
      if (dropCounter > dropInterval){
        piece.y++;
        if (collide()){
          piece.y--;
          merge();
          clearLines();
          newPiece();
        }
        dropCounter = 0;
      }
      draw();
    }
    rafId = requestAnimationFrame(update);
  }

  function newPiece(){
    piece = next || rndPiece();
    next  = rndPiece();
    drawNext();
    if (collide()){
      reset();
      newPiece();
    }
  }

  // Controles
  function move(dx){ piece.x+=dx; if(collide()) piece.x-=dx; }
  function soft(){ piece.y++; if(collide()){ piece.y--; merge(); clearLines(); newPiece(); dropCounter=0; } }
  function hard(){ while(!collide()) piece.y++; piece.y--; merge(); clearLines(); newPiece(); dropCounter=0; }
  function rot(){ const r=rotate(piece.m); const old=piece.m; piece.m=r; if(collide()) piece.m=old; }

  // API pública usada pela página
  window.initTetris = function initTetris(options){
    cfg = options || {};
    if (!cfg.canvas || !cfg.preview) return;

    // preparar canvas com DPR
    ctx  = setupCanvas(cfg.canvas,  COLS*BS, ROWS*BS);
    pctx = setupCanvas(cfg.preview, 96, 96);

    reset();
    newPiece();
    drawNext();

    if (!rafId) requestAnimationFrame(update);
  };

  window.resetTetris = function(){
    reset(); newPiece(); draw(); drawNext();
  };
  window.togglePauseTetris = function(){ paused = !paused; };

  // D-pad mobile em games.html chama isso
  window.ctrlTetris = function(action){
    if (!cfg) return;
    if (action==='left') move(-1);
    if (action==='right') move(1);
    if (action==='soft') soft();
    if (action==='hard') hard();
    if (action==='rotate') rot();
  };

  // Teclado (desktop)
  function onKey(e){
    if (!ctx) return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
    if(e.key==='ArrowLeft') move(-1);
    if(e.key==='ArrowRight') move(1);
    if(e.key==='ArrowDown') soft();
    if(e.key===' ') hard();
    if(e.key==='ArrowUp') rot();
  }
  window.addEventListener('keydown', onKey, {passive:false});

})();