let map;
let hubMarker;
let ordersLayer;
let routeLayerGA;
let routeLayerPSO;
let routeLayerACO;

// Icono personalizado para el Centro de Distribución
const hubIcon = L.divIcon({
  className: "custom-hub-icon",
  html: `<div style="background-color: #ef4444; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5); font-size: 14px;">🏢</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

// Icono para las órdenes de entrega
function createOrderIcon(index) {
  return L.divIcon({
    className: "custom-order-icon",
    html: `<div style="background-color: #3b82f6; color: #fff; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">${index}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

function initMap(initialLat, initialLon) {
  map = L.map("map", {
    zoomControl: false
  }).setView([initialLat, initialLon], 13);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // OpenStreetMap Tiles con filtro cálido vía CSS
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Grupos de capas
  ordersLayer = L.featureGroup().addTo(map);
  routeLayerGA = L.featureGroup().addTo(map);
  routeLayerPSO = L.featureGroup().addTo(map);
  routeLayerACO = L.featureGroup().addTo(map);

  // Marcador del Centro de Distribución (Hub)
  hubMarker = L.marker([initialLat, initialLon], {
    icon: hubIcon,
    draggable: true
  }).addTo(map);

  hubMarker.bindPopup("<b>Centro de Distribución (Hub)</b><br>Arrastra para reubicar").openPopup();

  hubMarker.on("dragend", function (e) {
    const pos = e.target.getLatLng();
    window.onHubMoved(pos.lat, pos.lng);
  });

  // Clic en el mapa para agregar orden
  map.on("click", function (e) {
    window.onMapClicked(e.latlng.lat, e.latlng.lng);
  });
}

function renderOrdersOnMap(orders) {
  ordersLayer.clearLayers();
  orders.forEach((order, idx) => {
    const marker = L.marker([order.lat, order.lon], {
      icon: createOrderIcon(idx + 1)
    });
    marker.bindPopup(`<b>Orden #${idx + 1}</b><br>${order.address || "Sin dirección"}<br><small>${order.service_time_min} min de entrega</small>`);
    ordersLayer.addLayer(marker);
  });

  if (orders.length > 0) {
    const group = L.featureGroup([hubMarker, ordersLayer]);
    map.fitBounds(group.getBounds().pad(0.15));
  }
}

function drawRoute(layer, coordinates, color, weight = 4, dashArray = null) {
  layer.clearLayers();
  if (!coordinates || coordinates.length < 2) return;

  const polyline = L.polyline(coordinates, {
    color: color,
    weight: weight,
    opacity: 0.85,
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
