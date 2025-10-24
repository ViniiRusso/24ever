// public/js/travel.js
// Borda SEMPRE visível; ao clicar: preenche, mantém borda e incrementa/decrementa contador + persiste no JSON.

(function(){
  const visited = new Set();
  const counter  = document.getElementById('visitedCount');
  const resetBtn = document.getElementById('btnReset');

  // BORDA (stroke) + FILL consistentes
  const styleNormal  = { color:'#ec4899', weight:2, fill:true, fillColor:'#fbcfe8', fillOpacity:.18, lineJoin:'round' };
  const styleVisited = { color:'#ec4899', weight:3, fill:true, fillColor:'#ec4899', fillOpacity:.72, lineJoin:'round' };

  const BR_URL = '/api/geo/brazil';
  const US_URL = '/api/geo/us';

  const BR_UF_BY_NAME = {
    "Acre":"AC","Alagoas":"AL","Amapá":"AP","Amazonas":"AM","Bahia":"BA","Ceará":"CE","Distrito Federal":"DF","Espírito Santo":"ES",
    "Goiás":"GO","Maranhão":"MA","Mato Grosso":"MT","Mato Grosso do Sul":"MS","Minas Gerais":"MG","Pará":"PA","Paraíba":"PB","Paraná":"PR",
    "Pernambuco":"PE","Piauí":"PI","Rio de Janeiro":"RJ","Rio Grande do Norte":"RN","Rio Grande do Sul":"RS","Rondônia":"RO","Roraima":"RR",
    "Santa Catarina":"SC","São Paulo":"SP","Sergipe":"SE","Tocantins":"TO"
  };
  const normalize = s => String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'');

  function stateIdFrom(feature){
    const p = feature?.properties || {};
    const admin = (p.country || p.admin || '').toString().toUpperCase();
    const isBR  = admin.includes('BRA');
    const isUS  = admin.includes('UNITED');
    const name  = p.name || p.state_name || p.state || '';
    const code  = (p.state_code || p.code || p.postal || '').toString().toUpperCase();
    if (isUS) return `US-${(code || normalize(name).slice(0,2)).toUpperCase()}`;
    if (isBR) return `BR-${(BR_UF_BY_NAME[name] || code || normalize(name).slice(0,2)).toUpperCase()}`;
    return `XX-${Math.random().toString(36).slice(2,7)}`;
  }

  function renderCount(){ if (counter) counter.textContent = String(visited.size); }

  // Mapa
  const map = L.map('map', { zoomControl:true, scrollWheelZoom:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(map);
  map.setView([10,-30], 3);
  setTimeout(()=>map.invalidateSize(), 100);

  function paint(layer, id){
    layer.setStyle(visited.has(id)? styleVisited : styleNormal);
    if (visited.has(id) && layer.bringToFront) layer.bringToFront();
  }

  function toggle(id, layer){
    if (visited.has(id)) visited.delete(id); else visited.add(id);
    paint(layer, id);
    renderCount();
    return visited.has(id);
  }

  function wire(feature, layer){
    const id   = stateIdFrom(feature);
    const name = feature?.properties?.name || feature?.properties?.state_name || 'Estado';
    layer.options.interactive = true;
    layer.options.fill = true;

    // borda visível desde o início
    paint(layer, id);
    layer.bindTooltip(name, {sticky:true, direction:'auto'});

    // clique/touch
    layer.on('click', async ()=>{
      const nowVisited = toggle(id, layer);
      try{
        await fetch('/api/map/states', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ id, visited: nowVisited })
        });
      }catch{
        // reverte em caso de erro de persistência
        toggle(id, layer);
      }
    });
  }

  async function load(){
    // estados salvos
    try {
      (await fetch('/api/map/states', {cache:'no-store'}).then(r=>r.json())).forEach(x=>visited.add(x));
    } catch {}
    renderCount();

    // geojsons
    const [gjBR, gjUS] = await Promise.all([
      fetch(BR_URL).then(r=>r.json()),
      fetch(US_URL).then(r=>r.json())
    ]);

    const layerBR = L.geoJSON(gjBR, { onEachFeature: wire });
    const layerUS = L.geoJSON(gjUS, { onEachFeature: wire });

    const grp = L.featureGroup([layerBR, layerUS]).addTo(map);
    map.fitBounds(grp.getBounds(), { padding:[20,20] });

    // repinta após fitBounds (garante borda/fill corretos)
    layerBR.eachLayer(l => paint(l, stateIdFrom(l.feature)));
    layerUS.eachLayer(l => paint(l, stateIdFrom(l.feature)));
  }

  resetBtn?.addEventListener('click', async ()=>{
    if (!visited.size) return;
    try{
      await fetch('/api/map/clear', { method:'POST' });
      visited.clear(); renderCount(); load();
    }catch{}
  }, {passive:true});

  load();
})();