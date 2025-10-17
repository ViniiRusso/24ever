const sinceEl = document.getElementById('since');
if (sinceEl) {
  const start = new Date('2022-10-24T20:00:00-03:00');
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    const now = new Date();
    let ms = now - start;
    const s = Math.floor(ms / 1000);
    const years = Math.floor(s / (365.25 * 24 * 3600));
    const days = Math.floor((s % (365.25 * 24 * 3600)) / (24 * 3600));
    const hours = Math.floor((s % (24 * 3600)) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    sinceEl.textContent = `${years}a ${pad(days)}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
  }
  tick();
  setInterval(tick, 1000);
}

// Áudio aleatório local
const mp3List = [
  'media/exemplo1.mp3',
  'media/exemplo2.mp3'
];

const audio = document.getElementById('bgm');
const btn = document.getElementById('playPause');
const vol = document.getElementById('volume');
const label = document.getElementById('currentTrack');

function pickTrack() { if (!mp3List.length) return null; const i = Math.floor(Math.random() * mp3List.length); return mp3List[i]; }
function loadRandom() { const t = pickTrack(); if (!t) return; audio.src = t; label.textContent = `tocando: ${t.split('/').pop()}`; }

if (audio && btn && vol) {
  audio.volume = parseFloat(vol.value); loadRandom();
  const allowPlay = () => { audio.play().catch(()=>{}); window.removeEventListener('click', allowPlay); };
  window.addEventListener('click', allowPlay);
  btn.addEventListener('click', () => { if (audio.paused) { audio.play(); btn.textContent = 'Pausar'; } else { audio.pause(); btn.textContent = 'Tocar'; } });
  vol.addEventListener('input', () => { audio.volume = parseFloat(vol.value); });
  audio.addEventListener('ended', () => { loadRandom(); audio.play().catch(()=>{}); });
}