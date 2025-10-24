// BR + EUA clicável de verdade: pointerdown (toque/mouse), highlight forte, bringToFront e persistência.
// Usa GeoJSON do backend (/api/geo/*) para evitar CORS. Salva em /api/map/states.

(function(){
  const toastEl = document.getElementById('toast');
  const visited = new Set();
  const counter  = document.getElementById('visitedCount');
  const resetBtn = document.getElementById('btnReset');

  // estilos muito contrastantes para não restar dúvida visual
  const styleN = { color:'#ec4899', weight:1,   fill:true, fillColor:'#fbcfe8', fillOpacity:.22, lineJoin:'round' };
  const styleV = { color:'#ec4899', weight:3,   fill:true, fillColor:'#ec4899', fillOpacity:.78, lineJoin:'round' };

  const BR_URL = '/api/geo/brazil';
  const US_URL = '/api/geo/us';

  const BR_UF_BY_NAME = {
    "Acre":"AC","Alagoas":"AL","Amapá":"AP","Amazonas":"AM","Bahia":"BA","Ceará":"CE","Distrito Federal":"DF","Espírito Santo":"ES",
    "Goiás":"GO","Maranhão":"MA","Mato Grosso":"MT","Mato Grosso do Sul":"MS","Minas Gerais":"MG","Pará":"PA","Paraíba":"PB","Paraná":"PR",
    "Pernambuco":"PE","Piauí":"PI","Rio de Janeiro":"RJ","Rio Grande do Norte":"RN","Rio Grande do Sul":"RS","Rondônia":"RO","Roraima":"RR",
    "Santa Catarina":"SC","São Paulo":"SP","Sergipe":"SE","Tocantins":"TO"
  };
  const normalize = s => String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'');

  function toast(msg){ if(!toastEl) return; toastEl.textContent = msg; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'), 2200); }
  function renderCount(){ if (counter) counter.textContent = String(visited.size); }

  function stateIdFrom(feature){
    const p = feature?.properties || {};
    const admin  = (p.country || p.admin || '').toString().toUpperCase();
    const isBR   = admin.includes('BRA');
    const isUS   = admin.includes('UNITED'); // United States
    const name   = p.name || p.state_name || p.state || '';
    const code   = (p.state_code || p.code || p.postal || '').toString().toUpperCase();
    if (isUS) { const us = code || normalize(name).slice(0,2).toUpperCase(); return `US-${us}`; }
    if (isBR) { const uf = BR_UF_BY_NAME[name] || code || normalize(name).slice(0,2).toUpperCase(); return `BR-${uf}`; }
    return `XX-${Math.random().toString(36).slice(2,7)}`;
  }

  // Mapa
  const map = L.map('map', { zoomControl:true, scrollWheelZoom:true, tap:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  map.setView([10,-30], 3);
  setTimeout(()=>map.invalidateSize(), 150);

  function applyStyle(layer, id){
    layer.setStyle(visited.has(id) ? styleV : styleN);
    if (visited.has(id) && layer.bringToFront) layer.bringToFront();
  }

  function toggleVisit(id, layer){
    const nowVisited = !visited.has(id);
    if (nowVisited) visited.add(id); else visited.delete(id);
    applyStyle(layer, id);
    renderCount();
    return nowVisited;
  }

  function wireFeature(feature, layer){
    const id   = stateIdFrom(feature);
    const name = feature?.properties?.name || feature?.properties?.state_name || 'Estado';

    // reforça interatividade
    layer.options.interactive = true;
    layer.options.fill = true;

    applyStyle(layer, id);
    layer.bindTooltip(name, { sticky:true, direction:'auto' });

    // usar pointerdown para cobrir toque + mouse em iOS/Android/desktop
    layer.on('pointerdown', async ()=>{
      const nowVisited = toggleVisit(id, layer);
      try{
        await fetch('/api/map/states', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ id, visited: nowVisited })
        });
      }catch(e){
        // reverte se falhar
        toggleVisit(id, layer);
        toast('Não consegui salvar agora. Tente novamente.');
      }
    });

    // acessibilidade teclado
    layer.on('keypress', (ev)=>{
      const k = ev.originalEvent?.key;
      if (k === 'Enter' || k === ' ') layer.fire('pointerdown');
    });
  }

  async function loadAll(){
    // 1) estados salvos
    let saved = [];
    try { saved = await fetch('/api/map/states', { cache:'no-store' }).then(r=>r.json()); } catch {}
    saved.forEach(x=>visited.add(x));
    renderCount();

    // 2) geojson via backend (sem CORS)
    const [gjBR, gjUS] = await Promise.all([
      fetch(BR_URL).then(r=>r.json()),
      fetch(US_URL).then(r=>r.json()),
    ]);

    const layerBR = L.geoJSON(gjBR, { onEachFeature: wireFeature });
    const layerUS = L.geoJSON(gjUS, { onEachFeature: wireFeature });

    const group = L.featureGroup([layerBR, layerUS]).addTo(map);
    map.fitBounds(group.getBounds(), { padding:[20,20] });

    // garante que os já visitados apareçam “acesos” pós-fitBounds
    layerBR.eachLayer(l => applyStyle(l, stateIdFrom(l.feature)));
    layerUS.eachLayer(l => applyStyle(l, stateIdFrom(l.feature)));
  }

  resetBtn?.addEventListener('click', async ()=>{
    if (!visited.size) return;
    try{
      await fetch('/api/map/clear', { method:'POST' });
      visited.clear(); renderCount();
      loadAll(); // recarrega e reaplica estilos
      toast('Contador resetado 👍');
    }catch{
      toast('Não deu pra resetar agora');
    }
  }, { passive:true });

  loadAll();
})();