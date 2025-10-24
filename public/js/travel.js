// /js/map.js — BR+US juntos, clique mobile/desktop, persistente e reset
(function(){
  const visited = new Set();
  let map, br, us;
  const counter = document.getElementById('visitedCount');
  const resetBtn = document.getElementById('btnReset');

  const styleN = { color:'#ec4899', weight:1, fillColor:'#fbcfe8', fillOpacity:.25 };
  const styleV = { color:'#ec4899', weight:1.5, fillColor:'#ec4899', fillOpacity:.65 };

  const BR = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';
  const US = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/united-states.geojson';

  const renderCount = ()=> counter.textContent = visited.size;

  const stateId = f=>{
    const name=(f?.properties?.name||f?.properties?.state_name||'').toUpperCase();
    const cc=(f?.properties?.country||'').toUpperCase();
    const pre=cc.includes('BRA')?'BR':cc.includes('UNITED')?'US':'X';
    const code=(f?.properties?.state_code||f?.properties?.code||name.slice(0,2)).toUpperCase();
    return `${pre}-${code}`;
  };

  async function toggle(id, layer){
    const v = !visited.has(id);
    v ? visited.add(id) : visited.delete(id);
    layer.setStyle(v?styleV:styleN);
    renderCount();
    try{
      await fetch('/api/map/states', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id, visited:v })
      });
    }catch{}
  }

  function each(f, l){
    const id=stateId(f);
    const name=f?.properties?.name||'Estado';
    l.bindTooltip(name,{sticky:true});
    const isV=visited.has(id);
    l.setStyle(isV?styleV:styleN);
    // pointerdown cobre mouse+toque (iOS/Android/desktop)
    l.on('pointerdown', ()=>toggle(id,l));
  }

  async function load(){
    const [saved, brGj, usGj] = await Promise.all([
      fetch('/api/map/states').then(r=>r.json()).catch(()=>[]),
      fetch(BR).then(r=>r.json()),
      fetch(US).then(r=>r.json())
    ]);

    saved.forEach(x=>visited.add(x));
    renderCount();

    br=L.geoJSON(brGj,{onEachFeature:each}).addTo(map);
    us=L.geoJSON(usGj,{onEachFeature:each}).addTo(map);

    const g=L.featureGroup([br,us]);
    map.fitBounds(g.getBounds(),{padding:[20,20]});
  }

  resetBtn.addEventListener('click', async ()=>{
    try{ await fetch('/api/map/clear',{method:'POST'}); }catch{}
    visited.clear(); renderCount();
    br?.eachLayer(l=>l.setStyle(styleN));
    us?.eachLayer(l=>l.setStyle(styleN));
  });

  // init
  map=L.map('map',{zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap',maxZoom:19
  }).addTo(map);
  map.setView([10,-30],2);
  setTimeout(()=>map.invalidateSize(),150);
  load();
})();