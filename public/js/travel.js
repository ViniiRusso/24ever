// BR + US com persistência em /api/map/states (arquivo JSON no servidor)
(function(){
  const toastEl = document.getElementById('toast');
  const visited = new Set();
  const counter  = document.getElementById('visitedCount');
  const resetBtn = document.getElementById('btnReset');

  const styleN = { color:'#ec4899', weight:1,   fillColor:'#fbcfe8', fillOpacity:.25 };
  const styleV = { color:'#ec4899', weight:1.4, fillColor:'#ec4899', fillOpacity:.62 };

  const BR = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';
  const US = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/united-states.geojson';

  function toast(msg){ if(!toastEl) return; toastEl.textContent = msg; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'), 2000); }
  function renderCount(){ counter.textContent = String(visited.size); }

  function stateIdFrom(f){
    const p = f?.properties || {};
    const name = (p.name || p.state_name || p.state || '').toString();
    const code = (p.state_code || p.code || p.postal || '').toString().toUpperCase();
    const admin= (p.country || p.admin || '').toString().toUpperCase();
    const cc = admin.includes('BRA') ? 'BR' : admin.includes('UNITED') ? 'US' : '';
    if (cc && code) return `${cc}-${code}`;
    if (cc && name) return `${cc}-${name.normalize('NFD').replace(/\p{Diacritic}/gu,'').split(/\s+/)[0].slice(0,2).toUpperCase()}`;
    return `XX-${Math.random().toString(36).slice(2,7)}`;
  }

  let map, layerBR, layerUS;
  map = L.map('map', { zoomControl:true, scrollWheelZoom:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19, attribution:'&copy; OpenStreetMap'
  }).addTo(map);
  map.setView([0, -30], 2);
  setTimeout(()=>map.invalidateSize(), 120);

  function applyStyle(el, id){ el.setStyle(visited.has(id) ? styleV : styleN); }

  function onEach(feature, layerEl){
    const id = stateIdFrom(feature);
    const name = feature?.properties?.name || feature?.properties?.state_name || 'Estado';

    applyStyle(layerEl, id);
    layerEl.bindTooltip(name, { sticky:true, direction:'auto' });

    layerEl.on('pointerdown', async ()=>{
      const nowVisited = !visited.has(id);
      if (nowVisited) visited.add(id); else visited.delete(id);
      applyStyle(layerEl, id);
      renderCount();
      try{
        await fetch('/api/map/states', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ id, visited: nowVisited })
        });
      }catch(e){
        if (nowVisited) visited.delete(id); else visited.add(id);
        applyStyle(layerEl, id);
        renderCount();
        toast('Não consegui salvar agora. Tenta de novo?');
      }
    });
  }

  async function loadAll(){
    try{
      const saved = await fetch('/api/map/states', { cache:'no-store' }).then(r=>r.json()).catch(()=>[]);
      saved.forEach(x=>visited.add(x));
      renderCount();

      const [gjBR, gjUS] = await Promise.all([ fetch(BR).then(r=>r.json()), fetch(US).then(r=>r.json()) ]);

      if (layerBR) map.removeLayer(layerBR);
      if (layerUS) map.removeLayer(layerUS);

      layerBR = L.geoJSON(gjBR, { onEachFeature: onEach });
      layerUS = L.geoJSON(gjUS, { onEachFeature: onEach });

      const group = L.featureGroup([layerBR, layerUS]).addTo(map);
      map.fitBounds(group.getBounds(), { padding:[20,20] });
    }catch(e){
      console.warn(e);
      toast('Falha ao carregar o mapa 😔');
    }
  }

  resetBtn?.addEventListener('click', async ()=>{
    if (!visited.size) return;
    try{
      await fetch('/api/map/clear', { method:'POST' });
      visited.clear(); renderCount();
      layerBR?.eachLayer(el=>el.setStyle(styleN));
      layerUS?.eachLayer(el=>el.setStyle(styleN));
      toast('Contador resetado 👍');
    }catch{
      toast('Não deu pra resetar agora');
    }
  }, { passive:true });

  loadAll();
})();