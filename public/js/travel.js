// Mapa BR+EUA com persistência em /api/map/states e GeoJSON servido pelo próprio backend.
// Funciona em mobile/desktop. Click/touch confiável.

(function(){
  const toastEl = document.getElementById('toast');
  const visited = new Set();
  const counter  = document.getElementById('visitedCount');
  const resetBtn = document.getElementById('btnReset');

  const styleN = { color:'#ec4899', weight:1,   fillColor:'#fbcfe8', fillOpacity:.25 };
  const styleV = { color:'#ec4899', weight:1.6, fillColor:'#ec4899', fillOpacity:.62 };

  const BR_URL = '/api/geo/brazil';
  const US_URL = '/api/geo/us';

  function toast(msg){ if(!toastEl) return; toastEl.textContent = msg; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'), 2200); }
  function renderCount(){ counter.textContent = String(visited.size); }

  // Tabela UF para robustez (caso o GeoJSON não traga 'state_code')
  const BR_UF_BY_NAME = {
    "Acre":"AC","Alagoas":"AL","Amapá":"AP","Amazonas":"AM","Bahia":"BA","Ceará":"CE","Distrito Federal":"DF","Espírito Santo":"ES",
    "Goiás":"GO","Maranhão":"MA","Mato Grosso":"MT","Mato Grosso do Sul":"MS","Minas Gerais":"MG","Pará":"PA","Paraíba":"PB","Paraná":"PR",
    "Pernambuco":"PE","Piauí":"PI","Rio de Janeiro":"RJ","Rio Grande do Norte":"RN","Rio Grande do Sul":"RS","Rondônia":"RO","Roraima":"RR",
    "Santa Catarina":"SC","São Paulo":"SP","Sergipe":"SE","Tocantins":"TO"
  };

  function normalize(s){ return String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,''); }

  function stateIdFrom(feature){
    const p = feature?.properties || {};
    const admin  = (p.country || p.admin || '').toString().toUpperCase();
    const isBR   = admin.includes('BRA');       // "Brazil" / "BRAZIL"
    const isUS   = admin.includes('UNITED');    // "United States"
    const name   = p.name || p.state_name || p.state || '';
    const code   = (p.state_code || p.code || p.postal || '').toString().toUpperCase();

    if (isUS) {
      // US: preferir state_code (AL, CA...). Se não houver, usar as 2 primeiras do nome.
      const us = code || normalize(name).slice(0,2).toUpperCase();
      return `US-${us}`;
    }
    if (isBR) {
      // BR: usar UF por tabela; fallback: 2 primeiras letras do nome
      const uf = BR_UF_BY_NAME[name] || code || normalize(name).slice(0,2).toUpperCase();
      return `BR-${uf}`;
    }
    // fallback (não esperado)
    return `XX-${Math.random().toString(36).slice(2,7)}`;
  }

  // Mapa
  const map = L.map('map', { zoomControl:true, scrollWheelZoom:true, tap:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  map.setView([10,-30], 3);
  setTimeout(()=>map.invalidateSize(), 150);

  function applyStyle(layer, id){ layer.setStyle(visited.has(id) ? styleV : styleN); }

  function onEach(feature, layerEl){
    const id   = stateIdFrom(feature);
    const name = feature?.properties?.name || feature?.properties?.state_name || 'Estado';
    applyStyle(layerEl, id);
    layerEl.bindTooltip(name, { sticky:true, direction:'auto' });

    // 'click' cobre mouse e touch no Leaflet; mais estável que pointerdown em alguns devices
    layerEl.on('click', async ()=>{
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
        // reverte se falhar persistência
        if (nowVisited) visited.delete(id); else visited.add(id);
        applyStyle(layerEl, id);
        renderCount();
        toast('Não consegui salvar agora. Tente novamente.');
      }
    });

    // acessibilidade/tato (opcional): enter/space
    layerEl.on('keypress', (ev)=>{
      if (ev.originalEvent?.key === 'Enter' || ev.originalEvent?.key === ' ') layerEl.fire('click');
    });
  }

  async function loadAll(){
    try{
      // 1) estados salvos
      const saved = await fetch('/api/map/states', { cache:'no-store' }).then(r=>r.json()).catch(()=>[]);
      saved.forEach(x=>visited.add(x));
      renderCount();

      // 2) geojson via backend (sem CORS)
      const [gjBR, gjUS] = await Promise.all([
        fetch(BR_URL).then(r=>r.json()),
        fetch(US_URL).then(r=>r.json()),
      ]);

      const layerBR = L.geoJSON(gjBR, { onEachFeature });
      const layerUS = L.geoJSON(gjUS, { onEachFeature });

      const group = L.featureGroup([layerBR, layerUS]).addTo(map);
      map.fitBounds(group.getBounds(), { padding:[20,20] });
    }catch(e){
      console.error('Falha no carregamento do mapa:', e);
      toast('Falha ao carregar o mapa.');
    }
  }

  resetBtn?.addEventListener('click', async ()=>{
    if (!visited.size) return;
    try{
      await fetch('/api/map/clear', { method:'POST' });
      visited.clear(); renderCount();
      // Recarrega para resetar estilos sem depender das refs dos layers
      loadAll();
      toast('Contador resetado 👍');
    }catch{
      toast('Não deu pra resetar agora');
    }
  }, { passive:true });

  loadAll();
})();