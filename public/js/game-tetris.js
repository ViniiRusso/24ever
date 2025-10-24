// /js/game-tetris.js — compatível com iOS Safari e games.js
(function(){
  const COLS=10, ROWS=20, BS=24;
  const colors=['#000','#fda4af','#f9a8d4','#a78bfa','#93c5fd','#86efac','#fcd34d','#fbbf24'];
  const shapes={I:[[1,1,1,1]],J:[[1,0,0],[1,1,1]],L:[[0,0,1],[1,1,1]],O:[[1,1],[1,1]],S:[[0,1,1],[1,1,0]],Z:[[1,1,0],[0,1,1]],T:[[0,1,0],[1,1,1]]};
  let ctx,pctx,cfg,board,piece,next,score=0,level=1,lines=0,dropCounter=0,dropInterval=600,last=0,raf,paused=false;

  const rnd=()=>Object.keys(shapes)[(Math.random()*7)|0];
  const clone=m=>m.map(r=>r.slice());
  const newPiece=()=>({m:clone(shapes[rnd()]),x:3,y:0,c:1+((Math.random()*6)|0)});
  const rotate=m=>m[0].map((_,i)=>m.map(r=>r[i])).reverse();
  const collide=()=>piece.m.some((r,dy)=>r.some((v,dx)=>v&&((board[piece.y+dy]||[])[piece.x+dx])!==0));
  const merge=()=>piece.m.forEach((r,dy)=>r.forEach((v,dx)=>v&&(board[piece.y+dy][piece.x+dx]=piece.c)));

  const drawHeart=(c,x,y,col,s)=>{
    c.fillStyle=colors[col];
    c.beginPath();
    c.moveTo(x*s+s/2,y*s+s*0.75);
    c.bezierCurveTo(x*s+s*1.2,y*s+s*0.2,x*s+s*0.8,y*s,x*s+s/2,y*s+s*0.35);
    c.bezierCurveTo(x*s+s*0.2,y*s,x*s-s*0.2,y*s+s*0.2,x*s+s/2,y*s+s*0.75);
    c.fill();
  };

  const draw=()=>{
    const w=COLS*BS,h=ROWS*BS;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#fffafc';
    ctx.fillRect(0,0,w,h);
    board.forEach((r,y)=>r.forEach((v,x)=>v&&drawHeart(ctx,x,y,v,BS)));
    piece.m.forEach((r,y)=>r.forEach((v,x)=>v&&drawHeart(ctx,piece.x+x,piece.y+y,piece.c,BS)));
  };

  const reset=()=>{
    board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
    piece=null; next=newPiece(); score=0; level=1; lines=0;
    dropCounter=0; dropInterval=600; last=0;
    cfg?.onScore?.(0); cfg?.onLevel?.(1);
  };

  const clear=()=>{
    let cleared=0;
    for(let y=ROWS-1;y>=0;y--)if(board[y].every(v=>v)){board.splice(y,1);board.unshift(Array(COLS).fill(0));cleared++;}
    if(cleared){score+=cleared*100;lines+=cleared;if(lines>=level*5){level++;dropInterval=Math.max(100,dropInterval-60);}cfg?.onScore?.(score);cfg?.onLevel?.(level);}
  };

  const spawn=()=>{piece=next;next=newPiece();if(collide())reset();};
  const drop=()=>{piece.y++;if(collide()){piece.y--;merge();clear();spawn();}dropCounter=0;};

  const update=t=>{
    const d=t-last; last=t;
    if(!paused){ dropCounter+=d; if(dropCounter>dropInterval) drop(); }
    draw(); raf=requestAnimationFrame(update);
  };

  const move=d=>{piece.x+=d;if(collide())piece.x-=d;};
  const soft=()=>drop();
  const hard=()=>{while(!collide())piece.y++;piece.y--;merge();clear();spawn();dropCounter=0;};
  const rot=()=>{const m=rotate(piece.m);const o=piece.m;piece.m=m;if(collide())piece.m=o;};

  // API usada por games.html/games.js
  window.initTetris=o=>{
    cfg=o;
    ctx=cfg.canvas.getContext('2d');
    pctx=cfg.preview.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    reset(); spawn();
    cancelAnimationFrame(raf); raf=requestAnimationFrame(update);
  };
  window.ctrlTetris=a=>{ if(a==='left')move(-1); if(a==='right')move(1); if(a==='soft')soft(); if(a==='hard')hard(); if(a==='rotate')rot(); };
  window.resetTetris=()=>{ reset(); spawn(); };
  window.togglePauseTetris=()=>{ paused=!paused; };
})();