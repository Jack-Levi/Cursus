let map;
let hubMarker;
let ordersLayer;
let routeLayerGA;
let routeLayerPSO;
let routeLayerACO;

// Marcador SVG para la Estación de Distribución (Terracota / Rojo Industrial #C2410C)
const hubSvgIcon = L.divIcon({
  className: "leaflet-hub-marker",
  html: `
    <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2C8.82 2 3 7.82 3 15C3 24 16 36 16 36C16 36 29 24 29 15C29 7.82 23.18 2 16 2Z" fill="#C2410C" stroke="#7C2D12" stroke-width="1.5"/>
      <rect x="10.5" y="10" width="11" height="10" rx="1.5" fill="#FFFFFF"/>
      <path d="M10.5 13H21.5M16 10V20" stroke="#C2410C" stroke-width="1.2"/>
    </svg>
  `,
  iconSize: [32, 38],
  iconAnchor: [16, 36],
  popupAnchor: [0, -34]
});

// Marcador SVG numerado para paquetes de entrega (Gris grafito sobrio con borde blanco)
function createOrderSvgIcon(index) {
  const label = index < 10 ? `0${index}` : `${index}`;
  return L.divIcon({
    className: "leaflet-order-marker",
    html: `
      <svg width="26" height="32" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 1C6.92 1 2 5.92 2 12C2 19.5 13 30 13 30C13 30 24 19.5 24 12C24 5.92 19.08 1 13 1Z" fill="#1D222C" stroke="#4B5563" stroke-width="1.4"/>
        <text x="13" y="15" fill="#F3F4F6" font-size="9" font-weight="600" text-anchor="middle" font-family="'JetBrains Mono', monospace">${label}</text>
      </svg>
    `,
    iconSize: [26, 32],
    iconAnchor: [13, 30],
    popupAnchor: [0, -28]
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

  hubMarker.bindPopup("<strong>Estación de Distribución (Hub)</strong><br>Arrastre este marcador para reubicar la base en cualquier punto de la red vial.");

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
    marker.bindPopup(`<strong>Parada ${idx + 1} (${order.id || "Guía"})</strong><br>${order.address || "Dirección registrada"}<br><span class="font-mono">Tiempo en puerta: ${order.service_time_min} min</span>`);
    ordersLayer.addLayer(marker);
  });

  if (orders.length > 0) {
    const group = L.featureGroup([hubMarker, ordersLayer]);
    map.fitBounds(group.getBounds().pad(0.12));
  }
}

function drawRoute(layer, coordinates, color, weight = 2.8, dashArray = null) {
  layer.clearLayers();
  if (!coordinates || coordinates.length < 2) return;

  const polyline = L.polyline(coordinates, {
    color: color,
    weight: weight,
    opacity: 0.9,
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

function highlightHubMarker(enable = true) {
  if (!hubMarker || !map) return;
  const el = hubMarker.getElement();
  if (el) {
    if (enable) {
      el.classList.add("pulse-highlight");
    } else {
      el.classList.remove("pulse-highlight");
    }
  }
  if (enable) {
    map.setView(hubMarker.getLatLng(), 14, { animate: true });
    hubMarker.openPopup();
  }
}
