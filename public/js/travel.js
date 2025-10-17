// Our Travels – mapa mundial interativo (Leaflet)
// Pinta países tocando/clicando, salva no localStorage, exporta/importa JSON.

(function(){
    const MAP_ID = 'map';
    const LS_KEY = '24ever_travel_visited_v1';
    const visited = new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]'));
    const visitedCountEl = document.getElementById('visitedCount');
  
    const mapEl = document.getElementById(MAP_ID);
    if (!mapEl) return;
  
    // ---- Inicializa mapa (sem tiles, fundo clean) ----
    const map = L.map(MAP_ID, {
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true
    });
  
    // Fundo neutro (sem tiles) – só uma camada branca translúcida
    const bg = L.rectangle([[-90,-180],[90,180]], {
      color: '#ffffff', weight: 0, fillOpacity: 0.0
    }).addTo(map);
  
    // Ajuste inicial pra ver o mundo
    map.fitWorld({ animate: false, padding: [20,20] });
  
    // ---- Estilos ----
    const colorVisited = '#ec4899';
    const colorBorder = '#ffffff';
    const colorDefault = '#e5e7eb';
  
    function styleFor(feature){
      const id = countryId(feature);
      const isVisited = visited.has(id);
      return {
        weight: 0.6,
        color: colorBorder,
        opacity: 1,
        fillColor: isVisited ? colorVisited : colorDefault,
        fillOpacity: isVisited ? 0.85 : 0.6
      };
    }
  
    function countryId(feature){
      // tenta vários campos comuns pra id estável
      const p = feature.properties || {};
      return p.iso_a3 || p.ISO_A3 || p.adm0_a3 || p.gu_a3 || p.name || p.ADMIN || p.NAME || String(feature.id || '').trim();
    }
    function countryName(feature){
      const p = feature.properties || {};
      return p.name || p.ADMIN || p.NAME || p.sovereignt || p.formal_en || p.geounit || countryId(feature) || 'País';
    }
  
    // ---- Eventos por país ----
    function onEach(feature, layer){
      layer.on({
        click: () => toggleCountry(feature, layer),
        mouseover: () => layer.setStyle({ fillOpacity: styleFor(feature).fillOpacity + 0.08 }),
        mouseout: () => layer.setStyle(styleFor(feature)),
        // Toque mais confortável no iPhone
        touchstart: (e) => { e.originalEvent.preventDefault?.(); toggleCountry(feature, layer); }
      });
      layer.bindTooltip(countryName(feature), {sticky:true, direction:'center', className:'leaflet-tooltip-own'});
    }
  
    function toggleCountry(feature, layer){
      const id = countryId(feature);
      if (!id) return;
      if (visited.has(id)) visited.delete(id); else visited.add(id);
      layer.setStyle(styleFor(feature));
      persist();
      updateCounter();
    }
  
    function persist(){
      localStorage.setItem(LS_KEY, JSON.stringify(Array.from(visited)));
    }
    function updateCounter(){
      visitedCountEl && (visitedCountEl.textContent = String(visited.size));
    }
  
    // ---- Carrega GeoJSON (com fallback de fontes) ----
    (async function loadData(){
      const sources = [
        // cdn jsDelivr com países (GeoJSON leve, inclui nomes/ISO)
        'https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json',
        // alternativa (outro mirror)
        'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json',
      ];
      let data = null;
      for (const url of sources){
        try{
          const r = await fetch(url, {cache:'no-store'});
          if (r.ok){
            data = await r.json();
            break;
          }
        }catch(_){}
      }
      if (!data){
        // fallback mínimo caso tudo falhe: desenha só o retângulo do mundo
        console.warn('Falha ao baixar GeoJSON. Mostrando fundo simples.');
        updateCounter();
        return;
      }
  
      // Ajuste de CRS/geo se necessário
      const layer = L.geoJSON(data, {
        style: styleFor,
        onEachFeature: onEach
      }).addTo(map);
  
      // melhora o ajuste ao conteúdo
      try { map.fitBounds(layer.getBounds(), {padding:[10,10]}); } catch(_){}
  
      updateCounter();
    })();
  
    // ---- Botões: reset/export/import ----
    const btnReset = document.getElementById('btnReset');
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const importBox = document.getElementById('importBox');
    const importText = document.getElementById('importText');
    const confirmImport = document.getElementById('confirmImport');
    const cancelImport = document.getElementById('cancelImport');
  
    btnReset?.addEventListener('click', ()=>{
      if (!confirm('Tem certeza que quer limpar tudo?')) return;
      visited.clear();
      persist();
      // recarrega para reflitar estilos rapidamente
      location.reload();
    });
  
    btnExport?.addEventListener('click', ()=>{
      const json = JSON.stringify(Array.from(visited), null, 2);
      // copia pro clipboard (quando disponível)
      if (navigator.clipboard) {
        navigator.clipboard.writeText(json).catch(()=>{});
      }
      // mostra também num prompt pra facilitar
      alert('IDs copiados para a área de transferência (se permitido). Abaixo o JSON:\n\n' + json);
    });
  
    btnImport?.addEventListener('click', ()=>{
      importBox?.classList.add('show');
      importText?.focus();
    });
    cancelImport?.addEventListener('click', ()=>{
      importBox?.classList.remove('show');
      importText.value = '';
    });
    confirmImport?.addEventListener('click', ()=>{
      try{
        const arr = JSON.parse(importText.value || '[]');
        if (!Array.isArray(arr)) throw new Error('Formato inválido');
        visited.clear();
        arr.forEach(id=>visited.add(String(id)));
        persist();
        location.reload();
      }catch(e){
        alert('JSON inválido. Cole exatamente o que foi exportado.');
      }
    });
  })();
  