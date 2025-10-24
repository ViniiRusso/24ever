// BR + EUA clicável com persistência via /api/map/states.
// Corrige: ids determinísticos (sem depender de properties.admin/country),
// usa evento 'click' do Leaflet, aplica estilos fortes e re-aplica após fitBounds.

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

  // Mapa de nomes -> siglas dos EUA (50 + DC + PR)
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
    setTimeout(()=>toastEl.classList.add('hidden'), 2000);
  }
  function renderCount(){ if (counter) counter.textContent = String(visited.size); }

  // Gera um ID estável por país + código de estado
  function stateIdFrom(country, feature){
    const p = feature?.properties || {};
    const name = p.name || p.state_name || p.state || '';
    const code = (p.state_code || p.code || p.postal || '').toString().toUpperCase();

    if (country === 'US') {
      const us = code || US_CODE_BY_NAME[name] || US_CODE_BY_NAME[Object.keys(US_CODE_BY_NAME).find(k => normalize(k) === normalize(name))] || normalize(name).slice(0,2).toUpperCase();
      return `US-${us}`;
    }
    if (country === 'BR') {
      const uf = BR_UF_BY_NAME[name] || BR_UF_BY_NAME[Object.keys(BR_UF_BY_NAME).find(k => normalize(k) === normalize(name))] || code || normalize(name).slice(0,2).toUpperCase();
      return `BR-${uf}`;
    }
    // fallback (não esperado)
    return `XX-${normalize(name)}`;
  }

  // Mapa base
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

  function makeOnEachFeature(country){
    return function(feature, layer){
      const id   = stateIdFrom(country, feature);
      const name = feature?.properties?.name || feature?.properties?.state_name || 'Estado';

      // reforça interatividade
      layer.options.interactive = true;
      layer.options.fill = true;

      applyStyle(layer, id);
      layer.bindTooltip(`${name}`, { sticky:true, direction:'auto' });

      // clique (desktop e mobile)
      layer.on('click', async ()=>{
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

      // acessibilidade via teclado
      layer.on('keypress', (ev)=>{
        const k = ev.originalEvent?.key;
        if (k === 'Enter' || k === ' ') layer.fire('click');
      });
    };
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

    // limpa camadas antigas (se houver)
    map.eachLayer(l => { if (l instanceof L.GeoJSON) map.removeLayer(l); });

    const layerBR = L.geoJSON(gjBR, { onEachFeature: makeOnEachFeature('BR') });
    const layerUS = L.geoJSON(gjUS, { onEachFeature: makeOnEachFeature('US') });

    const group = L.featureGroup([layerBR, layerUS]).addTo(map);
    map.fitBounds(group.getBounds(), { padding:[20,20] });

    // garante que os já visitados apareçam “acesos” pós-fitBounds
    layerBR.eachLayer(l => applyStyle(l, stateIdFrom('BR', l.feature)));
    layerUS.eachLayer(l => applyStyle(l, stateIdFrom('US', l.feature)));
  }

  resetBtn?.addEventListener('click', async ()=>{
    if (!visited.size) return;
    try{
      await fetch('/api/map/clear', { method:'POST' });
      visited.clear(); renderCount();
      await loadAll(); // recarrega e reaplica estilos
      toast('Contador resetado 👍');
    }catch{
      toast('Não deu pra resetar agora');
    }
  }, { passive:true });

  loadAll();
})();