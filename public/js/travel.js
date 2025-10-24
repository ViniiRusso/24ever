// travel.js — mostra Brasil e EUA juntos, sem alternar, com marcadores interativos
(async function(){
  const map = L.map('map', {
    zoomControl: true,
    scrollWheelZoom: true,
  });

  // OpenStreetMap base
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // URLs GeoJSON locais
  const URL_BR = '/data/br-states.geojson';
  const URL_US = '/data/us-states.geojson';

  // função para tentar ler GeoJSON localmente
  async function getJSON(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.statusText);
      return await r.json();
    } catch (e) {
      console.warn('Erro ao carregar GeoJSON:', url, e);
      return null;
    }
  }

  const [brData, usData] = await Promise.all([
    getJSON(URL_BR),
    getJSON(URL_US)
  ]);

  if (!brData && !usData) {
    alert('Não foi possível carregar os mapas 😢');
    return;
  }

  // função para destacar quando passar o mouse
  function styleDefault(feature) {
    return {
      fillColor: '#90cdf4',
      weight: 1,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.6
    };
  }

  function styleVisited(feature) {
    return {
      fillColor: '#2b6cb0',
      weight: 2,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.8
    };
  }

  const visitedStates = new Set(await loadVisited());

  function onEach(feature, layer, type) {
    const name = feature.properties.name || 'Unknown';
    const id = `${type}-${name}`;
    const isVisited = visitedStates.has(id);
    layer.setStyle(isVisited ? styleVisited(feature) : styleDefault(feature));

    layer.bindTooltip(`${name}`, { direction: 'center', permanent: false });

    layer.on('click', async () => {
      const newVisited = !visitedStates.has(id);
      visitedStates[newVisited ? 'add' : 'delete'](id);
      layer.setStyle(newVisited ? styleVisited(feature) : styleDefault(feature));
      await saveVisited(id, newVisited);
    });
  }

  const layerBR = brData ? L.geoJSON(brData, {
    onEachFeature: (f, l) => onEach(f, l, 'BR')
  }) : null;

  const layerUS = usData ? L.geoJSON(usData, {
    onEachFeature: (f, l) => onEach(f, l, 'US')
  }) : null;

  const group = L.featureGroup([layerBR, layerUS].filter(Boolean)).addTo(map);
  map.fitBounds(group.getBounds(), { padding: [20, 20] });

  // legenda
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = `
      <h4>Legenda</h4>
      <p><span style="background:#2b6cb0"></span> Visitado</p>
      <p><span style="background:#90cdf4"></span> Não visitado</p>
      <small>Toque em um estado para marcar.</small>
    `;
    return div;
  };
  legend.addTo(map);

  // ─── funções API ───
  async function loadVisited() {
    try {
      const r = await fetch('/api/map/states');
      return r.ok ? await r.json() : [];
    } catch { return []; }
  }

  async function saveVisited(id, visited) {
    try {
      await fetch('/api/map/states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, visited })
      });
    } catch (e) {
      console.error('Erro ao salvar estado visitado:', e);
    }
  }

})();