// BR + EUA clicável com persistência via /api/map/states.
// Corrige: usar 'click' (e fallback touchstart), IDs determinísticos, re-aplica estilos.

(function(){
  const toastEl = document.getElementById('toast');
  const visited = new Set();
  const counter  = document.getElementById('visitedCount');
  const resetBtn = document.getElementById('btnReset');

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

  const US_CODE_BY_NAME = {
    "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE",
    "District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA",
    "Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN",
    "Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ",
    "New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR",
    "Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT",
    "Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY","Puerto Rico":"PR"
  };

  const normalize = s => String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'');

  function toast(msg){
    if(!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    setTimeout(()=>toastEl.classList.add('hidden'), 1800);
  }
  function renderCount(){ if (counter) counter.textContent = String(visited.size); }

  function stateIdFrom(country, feature){
    const p = feature?.properties || {};
    const name = p.name || p.state_name || p.state || '';
    const code = (p.state_code || p.code || p.postal || '').toString().toUpperCase();

    if (country === 'US') {
      const us = code
        || US_CODE_BY_NAME[name]
        || US_CODE_BY_NAME[Object.keys(US_CODE_BY_NAME).find(k => normalize(k) === normalize(name))]
        || normalize(name).slice(0,2).toUpperCase();
      return `US-${us}`;
    }
    if (country === 'BR') {
      const uf = BR_UF_BY_NAME[name]
        || BR_UF_BY_NAME[Object.keys(BR_UF_BY_NAME).find(k => normalize(k) === normalize(name))]
        || code || normalize(name).slice(0,2).toUpperCase();
      return `BR-${uf}`;
    }
    return `XX-${normalize(name)}`;
  }

  // mapa base + pane para garantir clique acima dos tiles
  const map = L.map('map', { zoomControl:true, scrollWheelZoom:true, tap:true });
  const statesPane = map.createPane('states');
  statesPane.style.zIndex = 650;
  statesPane.style.pointerEvents = 'auto';

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

  function wireFeature(country){
    return (feature, layer)=>{
      const id   = stateIdFrom(country, feature);
      const name = feature?.properties?.name || feature?.properties?.state_name || 'Estado';

      layer.options.interactive = true;
      layer.options.fill = true;
      layer.options.pane = 'states';

      applyStyle(layer, id);
      layer.bindTooltip(name, { sticky:true, direction:'auto' });

      const handle = async ()=>{
        const nowVisited = toggleVisit(id, layer);
        try{
          const r = await fetch('/api/map/states', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ id, visited: nowVisited })
          });
          if (!r.ok) throw new Error('HTTP '+r.status);
        }catch(e){
          // reverte se falhar
          toggleVisit(id, layer);
          toast('Não consegui salvar agora. Tente novamente.');
          console.error(e);
        }
      };

      // clique padrão + fallback touchstart (alguns iOS antigos)
      layer.on('click', handle);
      layer.on('touchstart', (ev)=>{ ev.originalEvent?.preventDefault?.(); handle(); });

      // acessibilidade teclado
      layer.on('keypress', (ev)=>{
        const k = ev.originalEvent?.key;
        if (k === 'Enter' || k === ' ') handle();
      });
    };
  }

  let layerBR, layerUS;

  async function loadAll(){
    // 1) estados salvos
    visited.clear();
    try {
      const saved = await fetch('/api/map/states', { cache:'no-store' }).then(r=>r.json());
      saved.forEach(x=>visited.add(x));
    } catch {}
    renderCount();

    // 2) geojson via backend
    const [gjBR, gjUS] = await Promise.all([
      fetch(BR_URL).then(r=>r.json()),
      fetch(US_URL).then(r=>r.json()),
    ]);

    // remove camadas antigas (se recarregar)
    if (layerBR) map.removeLayer(layerBR);
    if (layerUS) map.removeLayer(layerUS);

    layerBR = L.geoJSON(gjBR, { onEachFeature: wireFeature('BR'), pane:'states' });
    layerUS = L.geoJSON(gjUS, { onEachFeature: wireFeature('US'), pane:'states' });

    const group = L.featureGroup([layerBR, layerUS]).addTo(map);
    map.fitBounds(group.getBounds(), { padding:[20,20] });

    // reaplica estilos pós-fitBounds
    layerBR.eachLayer(l => applyStyle(l, stateIdFrom('BR', l.feature)));
    layerUS.eachLayer(l => applyStyle(l, stateIdFrom('US', l.feature)));
  }

  resetBtn?.addEventListener('click', async ()=>{
    if (!visited.size) return;
    try{
      const r = await fetch('/api/map/clear', { method:'POST' });
      if (!r.ok) throw new Error();
      await loadAll();
      toast('Contador resetado 👍');
    }catch{
      toast('Não deu pra resetar agora');
    }
  }, { passive:true });

  loadAll();
})();