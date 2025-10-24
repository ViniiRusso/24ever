// game-tetris.js — API global: window.Tetris

window.Tetris = (function(){
  const tCanvas = document.getElementById('tetris');
  if (!tCanvas) return {
    start(){}, stop(){}, isRunning(){return false;},
    move(){}, softDrop(){}, hardDrop(){}, rotate(){},
    togglePause(){}, paused:false
  };

  const ctx = tCanvas.getContext('2d', { alpha: false });
  const nextCtx = document.getElementById('nextPiece').getContext('2d');
  const scoreEl = document.getElementById('tScore');
  const levelEl = document.getElementById('tLevel');

  const COLS=10, ROWS=20, BS=24;
  const shapes={ I:[[1,1,1,1]], J:[[1,0,0],[1,1,1]], L:[[0,0,1],[1,1,1]], O:[[1,1],[1,1]], S:[[0,1,1],[1,1,0]], Z:[[1,1,0],[0,1,1]], T:[[0,1,0],[1,1,1]] };
  const colors=['#000','#fda4af','#f9a8d4','#a78bfa','#93c5fd','#86efac','#fcd34d','#fbbf24'];

  let board, piece, next, dropCounter, dropInterval, last, score, level, lines, rafId=null;
  let keyHandler; const keys=Object.keys(shapes);

  function rndPiece(){ const k=keys[(Math.random()*keys.length)|0]; return { m: shapes[k].map(r=>r.slice()), x:3, y:0, c: 1+((Math.random()*6)|0) }; }
  function reset(){ board = Array.from({length: ROWS},()=>Array(COLS).fill(0)); piece=null; next=rndPiece(); dropCounter=0; dropInterval=600; last=0; score=0; level=1; lines=0; scoreEl.textContent=score; levelEl.textContent=level; }
  function drawHeartAt(c2d,x,y,c,bs=BS){ c2d.fillStyle=colors[c]; c2d.beginPath(); const bx=x*bs, by=y*bs; c2d.moveTo(bx+bs/2, by+bs*0.75); c2d.bezierCurveTo(bx+bs*1.2, by+bs*0.2, bx+bs*0.8, by, bx+bs/2, by+bs*0.35); c2d.bezierCurveTo(bx+bs*0.2, by, bx-bs*0.2, by+bs*0.2, bx+bs/2, by+bs*0.75); c2d.fill(); }
  function drawNext(){ const m=next.m; nextCtx.clearRect(0,0,nextCtx.canvas.width,nextCtx.canvas.height); const bs=12; const offx=(nextCtx.canvas.width/ (window.devicePixelRatio||1) - m[0].length*bs)/2; const offy=(nextCtx.canvas.height/(window.devicePixelRatio||1) - m.length*bs)/2; nextCtx.save(); nextCtx.scale((window.devicePixelRatio||1),(window.devicePixelRatio||1)); nextCtx.translate(offx,offy); for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++) if(m[y][x]) drawHeartAt(nextCtx,x,y,next.c,bs); nextCtx.restore(); }
  function rotate(m){ const N=m.length,M=m[0].length; const r=Array.from({length:M},()=>Array(N).fill(0)); for(let y=0;y<N;y++) for(let x=0;x<M;x++) r[x][N-1-y]=m[y][x]; return r; }
  function collide(){ for(let y=0;y<piece.m.length;y++) for(let x=0;x<piece.m[y].length;x++) if(piece.m[y][x] && (board[y+piece.y]?.[x+piece.x] ?? 1)) return true; return false; }
  function merge(){ for(let y=0;y<piece.m.length;y++) for(let x=0;x<piece.m[y].length;x++) if(piece.m[y][x]) board[y+piece.y][x+piece.x]=piece.c; }
  function clearLines(){ let cleared=0; for(let y=ROWS-1;y>=0;y--){ if(board[y].every(v=>v)){ board.splice(y,1); board.unshift(Array(COLS).fill(0)); y++; cleared++; } } if(cleared){ lines+=cleared; score+=cleared*100*level; if(lines>=level*5){ level++; dropInterval=Math.max(120, dropInterval-60); } scoreEl.textContent=score; levelEl.textContent=level; } }
  function ghostY(){ let y=piece.y; while(true){ y++; if (overAt(y)) return y-1; } }
  function overAt(y){ for(let r=0;r<piece.m.length;r++) for(let c=0;c<piece.m[r].length;c++) if(piece.m[r][c] && (board[r+y]?.[c+piece.x] ?? 1)) return true; return false; }
  function draw(){ const dpr=(window.devicePixelRatio||1); const cssW=tCanvas.clientWidth||tCanvas.width; const cssH=tCanvas.clientHeight||tCanvas.height; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssW,cssH); ctx.fillStyle='#fffafc'; ctx.fillRect(0,0,cssW,cssH); const bs=Math.min(24, Math.floor(cssW/ COLS * 0.9)); const gy=ghostY(); for(let y=0;y<piece.m.length;y++) for(let x=0;x<piece.m[y].length;x++) if(piece.m[y][x]){ ctx.globalAlpha=.2; drawHeartAt(ctx,x+piece.x,y+gy,piece.c,bs); ctx.globalAlpha=1; } for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(board[y][x]) drawHeartAt(ctx,x,y,board[y][x],bs); for(let y=0;y<piece.m.length;y++) for(let x=0;x<piece.m[y].length;x++) if(piece.m[y][x]) drawHeartAt(ctx,x+piece.x,y+piece.y,piece.c,bs); }
  function update(t=0){ const d=t-last; last=t; if(!Tetris.paused){ dropCounter+=d; if(dropCounter>dropInterval){ piece.y++; if(collide()){ piece.y--; merge(); clearLines(); newPiece(); } dropCounter=0; } draw(); } rafId=requestAnimationFrame(update); }
  function newPiece(){ piece = next || rndPiece(); next = rndPiece(); drawNext(); if (collide()){ reset(); newPiece(); } }
  function move(dx){ piece.x+=dx; if(collide()) piece.x-=dx; }
  function softDrop(){ piece.y++; if(collide()){ piece.y--; merge(); clearLines(); newPiece(); dropCounter=0; } }
  function hardDrop(){ while(!collide()){ piece.y++; } piece.y--; merge(); clearLines(); newPiece(); dropCounter=0; }
  function onKey(e){ if (!rafId) return; if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault(); if(e.key==='ArrowLeft') move(-1); if(e.key==='ArrowRight') move(1); if(e.key==='ArrowDown') softDrop(); if(e.key===' ') hardDrop(); if(e.key==='ArrowUp'){ const r=rotate(piece.m); const old=piece.m; piece.m=r; if(collide()) piece.m=old; } }

  const Tetris = {
    paused:false,
    start(){ reset(); newPiece(); drawNext(); if(!rafId) update(); window.addEventListener('keydown', onKey); },
    stop(){ if(rafId){ cancelAnimationFrame(rafId); rafId=null; } window.removeEventListener('keydown', onKey); this.paused=false; },
    togglePause(){ this.paused=!this.paused; },
    isRunning(){ return !!rafId; },
    move, softDrop, hardDrop,
    rotate(){ const r=rotate(piece.m); const old=piece.m; piece.m=r; if(collide()) piece.m=old; }
  };
  return Tetris;
})();