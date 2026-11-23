let map;
let hubMarker;
let ordersLayer;
let routeLayerGA;
let routeLayerPSO;
let routeLayerACO;

// Marcador SVG para el Centro de Distribución (Rubí Técnico #FB7185)
const hubSvgIcon = L.divIcon({
  className: "leaflet-hub-marker",
  html: `
    <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="hub-shadow" x="0" y="0" width="32" height="38" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
      <g filter="url(#hub-shadow)">
        <path d="M16 2C8.82 2 3 7.82 3 15C3 23.5 16 34 16 34C16 34 29 23.5 29 15C29 7.82 23.18 2 16 2Z" fill="#121316" stroke="#FB7185" stroke-width="2"/>
        <circle cx="16" cy="14" r="5" fill="#FB7185"/>
      </g>
    </svg>
  `,
  iconSize: [32, 38],
  iconAnchor: [16, 34],
  popupAnchor: [0, -32]
});

// Marcador SVG numerado para órdenes (Obsidiana con borde blanco y tipografía monoespaciada)
function createOrderSvgIcon(index) {
  const label = index < 10 ? `0${index}` : `${index}`;
  return L.divIcon({
    className: "leaflet-order-marker",
    html: `
      <svg width="26" height="32" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <filter id="pin-shadow-${index}" x="0" y="0" width="26" height="32" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
        <g filter="url(#pin-shadow-${index})">
          <path d="M13 1C6.92 1 2 5.92 2 12C2 19 13 29 13 29C13 29 24 19 24 12C24 5.92 19.08 1 13 1Z" fill="#16171B" stroke="#FFFFFF" stroke-width="1.5"/>
          <text x="13" y="15" fill="#FFFFFF" font-size="9" font-weight="700" text-anchor="middle" font-family="'JetBrains Mono', monospace">${label}</text>
        </g>
      </svg>
    `,
    iconSize: [26, 32],
    iconAnchor: [13, 29],
    popupAnchor: [0, -26]
  });
}

function initMap(initialLat, initialLon) {
  map = L.map("map", {
    zoomControl: false
  }).setView([initialLat, initialLon], 13);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  ordersLayer = L.featureGroup().addTo(map);
  routeLayerGA = L.featureGroup().addTo(map);
  routeLayerPSO = L.featureGroup().addTo(map);
  routeLayerACO = L.featureGroup().addTo(map);

  hubMarker = L.marker([initialLat, initialLon], {
    icon: hubSvgIcon,
    draggable: true
  }).addTo(map);

  hubMarker.bindPopup("<strong>Centro de Distribución (Hub)</strong><br>Arrastre para reubicar la base de despacho.");

  hubMarker.on("dragend", function (e) {
    const pos = e.target.getLatLng();
    window.onHubMoved(pos.lat, pos.lng);
  });

  map.on("click", function (e) {
    window.onMapClicked(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => {
    map.invalidateSize();
  }, 150);
}

function renderOrdersOnMap(orders) {
  ordersLayer.clearLayers();
  orders.forEach((order, idx) => {
    const marker = L.marker([order.lat, order.lon], {
      icon: createOrderSvgIcon(idx + 1)
    });
    marker.bindPopup(`<strong>Parada ${idx + 1}</strong><br>${order.address || "Coordenada registrada"}<br><span class="font-mono">Atención: ${order.service_time_min} min</span>`);
    ordersLayer.addLayer(marker);
  });

  if (orders.length > 0) {
    const group = L.featureGroup([hubMarker, ordersLayer]);
    map.fitBounds(group.getBounds().pad(0.12));
  }
}

function drawRoute(layer, coordinates, color, weight = 3.2, dashArray = null) {
  layer.clearLayers();
  if (!coordinates || coordinates.length < 2) return;

  const polyline = L.polyline(coordinates, {
    color: color,
    weight: weight,
    opacity: 0.95,
    dashArray: dashArray,
    smoothFactor: 1.0
  });

  layer.addLayer(polyline);
}

function clearRoutes() {
  routeLayerGA.clearLayers();
  routeLayerPSO.clearLayers();
  routeLayerACO.clearLayers();
}

function toggleRouteLayer(algoName, visible) {
  if (algoName === "GA") {
    visible ? map.addLayer(routeLayerGA) : map.removeLayer(routeLayerGA);
  } else if (algoName === "PSO") {
    visible ? map.addLayer(routeLayerPSO) : map.removeLayer(routeLayerPSO);
  } else if (algoName === "ACO") {
    visible ? map.addLayer(routeLayerACO) : map.removeLayer(routeLayerACO);
  }
}
