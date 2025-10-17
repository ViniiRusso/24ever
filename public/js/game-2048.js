window.Game2048 = (function(){
  const canvas = document.getElementById('game2048');
  if (!canvas) return { start(){}, stop(){}, isRunning(){ return false; }, swipe(){} };

  const ctx = canvas.getContext('2d');
  const size = 4; 
  const scoreEl = document.getElementById('score2048');

  const face = { 2:'💗', 4:'💖', 8:'💞', 16:'💕', 32:'🫶', 64:'🌸', 128:'🌷', 256:'🎀', 512:'✨', 1024:'🌟', 2048:'💌' };
  const colors = { 0:'#fdf2f8', 2:'#ffe4e6', 4:'#fecdd3', 8:'#fda4af', 16:'#fb7185', 32:'#f472b6', 64:'#ec4899', 128:'#d946ef', 256:'#a78bfa', 512:'#818cf8', 1024:'#60a5fa', 2048:'#34d399' };

  let board, score, rafId=null, keyHandler;

  function cellSize(){ return canvas.width / size; }

  function draw() {
    const cell = cellSize();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    for (let r=0;r<size;r++) for (let c=0;c<size;c++){
      const v = board[r][c];
      const x = c*cell+6, y=r*cell+6, w=cell-12, h=cell-12;
      ctx.fillStyle = colors[v] || '#86efac';
      ctx.fillRect(x,y,w,h);
      if (v) {
        ctx.font = (cell>=90? 'bold 30px Poppins':'bold 22px Poppins');
        ctx.fillStyle = '#3730a3';
        ctx.fillText(face[v] || '💝', x+w/2, y+h/2);
      }
    }
  }

  function addTile() {
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

    if (prev!==JSON.stringify(board)) { addTile(); scoreEl.textContent=score; }
    draw();
  }

  function loop(){ draw(); rafId=requestAnimationFrame(loop); }

  function onKey(e){
    if (!rafId) return;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
    if (e.key==='ArrowLeft') operate('left');
    if (e.key==='ArrowRight') operate('right');
    if (e.key==='ArrowUp') operate('up');
    if (e.key==='ArrowDown') operate('down');
  }

  function start(){
    board = Array.from({length:size},()=>Array(size).fill(0));
    score = 0; scoreEl.textContent='0';
    addTile(); addTile();
    if (!rafId) loop();
    keyHandler = onKey; window.addEventListener('keydown', keyHandler);
  }

  function stop(){
    if (rafId){ cancelAnimationFrame(rafId); rafId=null; }
    window.removeEventListener('keydown', keyHandler);
  }

  function swipe(dir){ if (rafId) operate(dir); }
  function isRunning(){ return !!rafId; }

  return { start, stop, isRunning, swipe };
})();