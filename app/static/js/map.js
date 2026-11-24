let map;
let hubMarker;
let ordersLayer;
let routeLayerGA;
let routeLayerPSO;
let routeLayerACO;

// Marcador SVG para la Estación de Distribución (Amazon Amber #FF9900)
const hubSvgIcon = L.divIcon({
  className: "leaflet-hub-marker",
  html: `
    <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="hub-shadow" x="0" y="0" width="34" height="42" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.7"/>
      </filter>
      <g filter="url(#hub-shadow)">
        <path d="M17 2C9.27 2 3 8.27 3 16C3 25.5 17 38 17 38C17 38 31 25.5 31 16C31 8.27 24.73 2 17 2Z" fill="#131921" stroke="#FF9900" stroke-width="2.5"/>
        <rect x="11.5" y="10.5" width="11" height="11" rx="2" fill="#FF9900"/>
        <path d="M11.5 14H22.5M17 10.5V21.5" stroke="#131921" stroke-width="1.2"/>
      </g>
    </svg>
  `,
  iconSize: [34, 42],
  iconAnchor: [17, 38],
  popupAnchor: [0, -36]
});

// Marcador SVG numerado para paquetes de entrega (Amazon dark slate con borde ámbar y tipografía monoespaciada)
function createOrderSvgIcon(index) {
  const label = index < 10 ? `0${index}` : `${index}`;
  return L.divIcon({
    className: "leaflet-order-marker",
    html: `
      <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <filter id="pin-shadow-${index}" x="0" y="0" width="28" height="34" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
        <g filter="url(#pin-shadow-${index})">
          <path d="M14 1C7.37 1 2 6.37 2 13C2 20.8 14 31 14 31C14 31 26 20.8 26 13C26 6.37 20.63 1 14 1Z" fill="#1C2430" stroke="#FF9900" stroke-width="1.6"/>
          <text x="14" y="16" fill="#FFFFFF" font-size="9.5" font-weight="700" text-anchor="middle" font-family="'JetBrains Mono', monospace">${label}</text>
        </g>
      </svg>
    `,
    iconSize: [28, 34],
    iconAnchor: [14, 31],
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

  hubMarker.bindPopup("<strong>Estación de Entrega (Hub DS-MTY1)</strong><br>Arrastre este marcador para reubicar la nave industrial de salida y retorno.");

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
    marker.bindPopup(`<strong>Parada ${idx + 1} // ${order.id || "TBA"}</strong><br>${order.address || "Dirección registrada"}<br><span class="font-mono">Tiempo en puerta: ${order.service_time_min} min</span>`);
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
