let map;
let hubMarker;
let ordersLayer;
let routeLayerGA;
let routeLayerPSO;
let routeLayerACO;

// Marcador SVG para el Centro de Distribución
const hubSvgIcon = L.divIcon({
  className: "leaflet-hub-marker",
  html: `
    <svg width="30" height="36" viewBox="0 0 30 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.71573 0 0 6.71573 0 15C0 24 15 36 15 36C15 36 30 24 30 15C30 6.71573 23.2843 0 15 0Z" fill="#dc2626"/>
      <path d="M15 2C7.8203 2 2 7.8203 2 15C2 22.5 13.5 32.8 15 34.2C16.5 32.8 28 22.5 28 15C28 7.8203 22.1797 2 15 2Z" fill="#ef4444"/>
      <rect x="9" y="9" width="12" height="11" rx="1" fill="#ffffff"/>
      <rect x="11" y="14" width="3" height="6" fill="#dc2626"/>
      <rect x="16" y="14" width="3" height="6" fill="#dc2626"/>
    </svg>
  `,
  iconSize: [30, 36],
  iconAnchor: [15, 36],
  popupAnchor: [0, -34]
});

// Marcador SVG numerado para órdenes de entrega
function createOrderSvgIcon(index) {
  return L.divIcon({
    className: "leaflet-order-marker",
    html: `
      <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 12 30 12 30C12 30 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#1d4ed8"/>
        <circle cx="12" cy="11" r="9" fill="#2563eb"/>
        <text x="12" y="14" fill="#ffffff" font-size="10" font-weight="700" text-anchor="middle" font-family="-apple-system, sans-serif">${index}</text>
      </svg>
    `,
    iconSize: [24, 30],
    iconAnchor: [12, 30],
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

  hubMarker.bindPopup("<strong>Centro de Distribución</strong><br>Arrastre el marcador para reubicar la base.");

  hubMarker.on("dragend", function (e) {
    const pos = e.target.getLatLng();
    window.onHubMoved(pos.lat, pos.lng);
  });

  map.on("click", function (e) {
    window.onMapClicked(e.latlng.lat, e.latlng.lng);
  });

  // Forzar redimensionamiento inicial para garantizar renderizado inmediato del lienzo
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
    marker.bindPopup(`<strong>Orden ${idx + 1}</strong><br>${order.address || "Coordenada registrada"}<br>Tiempo de atención: ${order.service_time_min} min`);
    ordersLayer.addLayer(marker);
  });

  if (orders.length > 0) {
    const group = L.featureGroup([hubMarker, ordersLayer]);
    map.fitBounds(group.getBounds().pad(0.12));
  }
}

function drawRoute(layer, coordinates, color, weight = 3.5, dashArray = null) {
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
