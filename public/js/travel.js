// Our Map (BR+US) — borda/hover/click claros, salva via API e não quebra se API falhar
(function(){
  const visitedCount = document.getElementById('visitedCount');
  const toastEl = document.getElementById('toast');
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  const visited = new Set(); // ids persistidos no backend

  // ---------- UI helpers ----------
  const styleNormal  = { color:'#ec4899', weight:1.2, fillColor:'#fbcfe8', fillOpacity:.28 };
  const styleVisited = { color:'#ec4899', weight:1.8, fillColor:'#ec4899', fillOpacity:.62 };

  function toast(msg){
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    setTimeout(()=>toastEl.classList.add('hidden'), 2200);
  }
  function renderCount(){ if (visitedCount) visitedCount.textContent = String(visited.size); }

  // ---------- Map ----------
  const map = L.map('map', { zoomControl:true, scrollWheelZoom:true, worldCopyJump:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  map.setView([10,-30], 3);

  // faz o ajuste de tamanho depois que a navbar assenta
  setTimeout(()=> map.invalidateSize(), 150);

  // ---------- Back-end: carregar estados já visitados ----------
  async function loadVisitedFromAPI(){
    try{
      const r = await fetch('/api/map/states', { cache: 'no-store' });
      if (!r.ok) throw new Error('API states 401/500');
      const arr = await r.json();
      arr.forEach(id => visited.add(String(id)));
      renderCount();
    }catch(e){
      console.warn('Não consegui ler /api/map/states. Vou continuar sem isso.', e);
      toast('Sem conexão pra estados salvos agora');
    }
  }

  // salva alternância (tolerante a falha)
  async function saveVisited(id, isVisited){
    try{
      await fetch('/api/map/states', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id, visited: isVisited })
      });
    }catch(e){
      console.warn('Falha ao salvar estado visitado:', e);
      toast('Não consegui salvar agora. Tenta de novo?');
    }
  }

  // ---------- Ids e Tooltips ----------
  function stateIdFrom(feature){
    const p = feature?.properties || {};
    // tenta códigos se existirem; senão usa país/UF por nome
    const iso = (p.code || p.iso_3166_2 || p.state_code || '').toString().toUpperCase();
    if (iso && iso.includes('-')) return iso;

    // País: BR ou US (vamos inferir pelos arquivos)
    const country = p.__country || p.country || p.admin || '';
    const cc = (country || '').toString().toUpperCase();

    const name = (p.name || p.state_name || p.sigla || '').toString().trim();
    if (cc === 'BR') return `BR-${(p.sigla || name.slice(0,3)).toString().toUpperCase()}`;
    if (cc === 'US') return `US-${(p.state_code || name.slice(0,3)).toString().toUpperCase()}`;

    // fallback: nome
    return (name || iso || 'STATE').toUpperCase();
  }
  function stateName(feature){
    const p = feature?.properties || {};
    return p.name || p.state_name || p.sigla || 'Estado';
  }

  // ---------- Interação por estado ----------
  function onEach(feature, layerEl){
    const id = stateIdFrom(feature);
    const isVisited = visited.has(id);
    layerEl.setStyle(isVisited ? styleVisited : styleNormal);

    layerEl.on('mouseover', ()=> {
      const base = visited.has(id) ? styleVisited : styleNormal;
      layerEl.setStyle({ ...base, weight: base.weight + 0.6, fillOpacity: Math.min(1, base.fillOpacity + 0.08) });
      if (layerEl.bringToFront) layerEl.bringToFront();
    });
    layerEl.on('mouseout', ()=> {
      const base = visited.has(id) ? styleVisited : styleNormal;
      layerEl.setStyle(base);
    });
    layerEl.on('click', async ()=>{
      const nowVisited = !visited.has(id);
      if (nowVisited) visited.add(id); else visited.delete(id);
      layerEl.setStyle(nowVisited ? styleVisited : styleNormal);
      renderCount();
      await saveVisited(id, nowVisited);
    });

    layerEl.bindTooltip(`${stateName(feature)}`, {sticky:true, direction:'auto'});
  }

  // ---------- Carregar os dois GeoJSON locais e unir ----------
  async function fetchJSON(url){
    const r = await fetch(url + `?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
    return r.json();
  }

  function tagCountry(gj, tag){
    // marca cada feature com __country = 'BR' ou 'US' pra geração de id
    if (gj && Array.isArray(gj.features)) {
      gj.features.forEach(f => {
        f.properties = f.properties || {};
        f.properties.__country = tag;
      });
    }
    return gj;
  }

  async function loadLayers(){
    try{
      const [br, us] = await Promise.all([
        fetchJSON('/data/br-states.geojson').then(g=>tagCountry(g,'BR')),
        fetchJSON('/data/us-states.geojson').then(g=>tagCountry(g,'US')),
      ]);

      const group = L.featureGroup();

      const brLayer = L.geoJSON(br, { onEachFeature: onEach });
      const usLayer = L.geoJSON(us, { onEachFeature: onEach });

      brLayer.addTo(group);
      usLayer.addTo(group);
      group.addTo(map);

      try { map.fitBounds(group.getBounds(), { padding:[20,20] }); } catch {}

    }catch(e){
      console.error('Falha ao carregar GeoJSON locais:', e);
      toast('Não consegui carregar o mapa 😔');
    }
  }

  (async function init(){
    await loadVisitedFromAPI();
    await loadLayers();
  })();
})();