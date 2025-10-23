// game-2048.js — expõe window.init2048 / window.reset2048 / window.move2048
(function(){
  let ctx, canvas, scoreEl, size = 4;
  let board, score, rafId = null;
  let touch = {x:0,y:0,active:false};

  function cell() { return canvas.width / size; }

  function draw(){
    const c = cell();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const colors = { 0:'#fdf2f8', 2:'#ffe4e6', 4:'#fecdd3', 8:'#fda4af', 16:'#fb7185', 32:'#f472b6', 64:'#ec4899', 128:'#d946ef', 256:'#a78bfa', 512:'#818cf8', 1024:'#60a5fa', 2048:'#34d399' };
    const face   = { 2:'💗', 4:'💖', 8:'💞', 16:'💕', 32:'🫶', 64:'🌸', 128:'🌷', 256:'🎀', 512:'✨', 1024:'🌟', 2048:'💌' };

    for (let r=0;r<size;r++) for (let c0=0;c0<size;c0++){
      const v = board[r][c0];
      const x = c0*c+6, y=r*c+6, w=c-12, h=c-12;
      ctx.fillStyle = colors[v] || '#86efac';
      ctx.fillRect(x,y,w,h);
      if (v){
        ctx.font = (c>=90? 'bold 30px Poppins':'bold 22px Poppins');
        ctx.fillStyle = '#3730a3';
        ctx.fillText(face[v] || '💝', x+w/2, y+h/2);
      }
    }
  }
  function loop(){ draw(); rafId = requestAnimationFrame(loop); }

  function addTile(){
    const empty=[];
    for (let r=0;r<size;r++) for (let c=0;c<size;c++) if(!board[r][c]) empty.push([r,c]);
    if(!empty.length) return false;
    const [r,c]=empty[(Math.random()*empty.length)|0];
    board[r][c] = Math.random()<0.9?2:4;
    return true;
  }

  const compress=row=>{ const a=row.filter(v=>v); while(a.length<size) a.push(0); return a; };
  const merge=row=>{ for(let i=0;i<size-1;i++) if(row[i] && row[i]===row[i+1]){ row[i]*=2; score+=row[i]; row[i+1]=0; } return row; };
  const rotL=m=>m[0].map((_,i)=>m.map(r=>r[i])).reverse();
  const rotR=m=>m[0].map((_,i)=>m.map(r=>r[i]).reverse());

  function operate(dir){
    let rotated=false, flipped=false;
    if (dir==='up'){ board=rotL(board); rotated=true; }
    if (dir==='down'){ board=rotR(board); rotated=true; }
    if (dir==='right'){ board=board.map(r=>r.reverse()); flipped=true; }

    const prev=JSON.stringify(board);
    board = board.map(r => compress(merge(compress(r))));

    if (flipped) board=board.map(r=>r.reverse());
    if (rotated && dir==='up') board=rotR(board);
    if (rotated && dir==='down') board=rotL(board);

    if (prev!==JSON.stringify(board)) { addTile(); scoreEl.textContent = String(score); }
    draw();
  }

  function onKey(e){
    if (!rafId) return;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
    if (e.key==='ArrowLeft') operate('left');
    if (e.key==='ArrowRight') operate('right');
    if (e.key==='ArrowUp') operate('up');
    if (e.key==='ArrowDown') operate('down');
  }

  function onTouchStart(e){
    const t = e.touches?.[0]; if (!t) return;
    touch.active = true; touch.x = t.clientX; touch.y = t.clientY;
  }
  function onTouchEnd(e){
    if (!touch.active) return; touch.active=false;
    const t = e.changedTouches?.[0]; if (!t) return;
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) operate(dx>0?'right':'left'); else operate(dy>0?'down':'up');
  }

  function resizeToParent(){
    const wrap = canvas.parentElement;
    const s = Math.min(wrap.clientWidth || 360, 420);
    canvas.width = canvas.height = Math.max(240, s);
  }

  function start(cnv, onScore){
    canvas = cnv;
    scoreEl = document.getElementById('score2048');
    ctx = canvas.getContext('2d');

    resizeToParent();
    window.addEventListener('resize', resizeToParent);

    board = Array.from({length:size},()=>Array(size).fill(0));
    score = 0; if (scoreEl) scoreEl.textContent='0';
    addTile(); addTile();
    if (!rafId) loop();

    window.addEventListener('keydown', onKey);
    canvas.addEventListener('touchstart', onTouchStart, {passive:true});
    canvas.addEventListener('touchend', onTouchEnd, {passive:false});

    // callback de score (mantém compatibilidade, se quiser usar)
    if (typeof onScore === 'function') onScore(score);
  }

  function reset(){
    if (!canvas) return;
    board = Array.from({length:size},()=>Array(size).fill(0));
    score = 0; if (scoreEl) scoreEl.textContent='0';
    addTile(); addTile();
    draw();
  }

  function move(dir){ operate(dir); }

  // assinatura esperada pelo seu games.js
  window.init2048  = start;
  window.reset2048 = reset;
  window.move2048  = move;
})();