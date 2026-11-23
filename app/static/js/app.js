// Estado de la aplicación
const state = {
  hub: { name: "Centro de Distribución Cursus", lat: 25.7250, lon: -100.3130 },
  orders: [],
  shift: { max_hours: 8.0, service_time_per_order_min: 12.0, buffer_time_min: 15.0 },
  convergenceChart: null
};

document.addEventListener("DOMContentLoaded", async () => {
  // Cargar configuración inicial
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    state.hub = data.hub;
    state.shift = data.shift;
  } catch (e) {
    console.warn("Usando configuración predeterminada local", e);
  }

  // Inicializar mapa
  initMap(state.hub.lat, state.hub.lon);

  // Vincular eventos del DOM
  document.getElementById("btn-add-address").addEventListener("click", handleAddAddress);
  document.getElementById("input-address").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleAddAddress();
  });
  document.getElementById("btn-sample-orders").addEventListener("click", generateSampleOrders);
  document.getElementById("btn-clear-orders").addEventListener("click", clearAllOrders);
  document.getElementById("btn-run-simulation").addEventListener("click", runSimulation);

  // Filtros de rutas
  document.getElementById("toggle-ga").addEventListener("change", (e) => toggleRouteLayer("GA", e.target.checked));
  document.getElementById("toggle-pso").addEventListener("change", (e) => toggleRouteLayer("PSO", e.target.checked));
  document.getElementById("toggle-aco").addEventListener("change", (e) => toggleRouteLayer("ACO", e.target.checked));

  // Generar 8 órdenes de muestra iniciales para que el usuario pueda probar de inmediato
  generateSampleOrders();
});

// Evento: Hub movido en el mapa
window.onHubMoved = async (lat, lon) => {
  state.hub.lat = lat;
  state.hub.lon = lon;
  try {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    state.hub.name = data.display_name;
  } catch (e) {
    state.hub.name = `Hub (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  }
  document.getElementById("hub-location-label").innerText = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
};

// Evento: Clic en el mapa para agregar orden
window.onMapClicked = async (lat, lon) => {
  let display = `Entrega (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  try {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (data.display_name) {
      display = data.display_name.split(",").slice(0, 3).join(",");
    }
  } catch (e) {
    // Si falla el reverse, mantener etiqueta básica
  }

  addOrder(lat, lon, display);
};

// Agregar orden por texto
async function handleAddAddress() {
  const input = document.getElementById("input-address");
  const address = input.value.trim();
  if (!address) return;

  const btn = document.getElementById("btn-add-address");
  btn.innerText = "Buscando...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });

    if (!res.ok) {
      alert("No se encontró la dirección indicada en OpenStreetMap.");
      return;
    }

    const data = await res.json();
    addOrder(data.lat, data.lon, data.display_name.split(",").slice(0, 3).join(","));
    input.value = "";
  } catch (e) {
    alert("Error de conexión al geocodificar dirección.");
  } finally {
    btn.innerText = "Agregar";
    btn.disabled = false;
  }
}

function addOrder(lat, lon, address = "") {
  const serviceTime = parseFloat(document.getElementById("input-service-time").value) || 12.0;
  const newOrder = {
    id: `ORD-${state.orders.length + 1}`,
    lat: lat,
    lon: lon,
    address: address || `Punto ${state.orders.length + 1}`,
    service_time_min: serviceTime
  };
  state.orders.push(newOrder);
  updateOrdersUI();
}

function removeOrder(index) {
  state.orders.splice(index, 1);
  // Reindexar IDs
  state.orders.forEach((o, i) => o.id = `ORD-${i + 1}`);
  updateOrdersUI();
}

function clearAllOrders() {
  state.orders = [];
  clearRoutes();
  updateOrdersUI();
  document.getElementById("results-panel").classList.remove("active");
}

function generateSampleOrders() {
  clearAllOrders();
  const baseLat = state.hub.lat;
  const baseLon = state.hub.lon;
  const count = 12;
  const serviceTime = parseFloat(document.getElementById("input-service-time").value) || 12.0;

  // Generar puntos dispersos en un radio aproximado de 3 a 7 km
  for (let i = 1; i <= count; i++) {
    const angle = (i * 2 * Math.PI) / count + (Math.random() * 0.4 - 0.2);
    const radius = 0.02 + Math.random() * 0.035; // ~2.5 - 6 km
    const lat = baseLat + radius * Math.cos(angle);
    const lon = baseLon + radius * Math.sin(angle) * 1.1;

    state.orders.push({
      id: `ORD-${i}`,
      lat: lat,
      lon: lon,
      address: `Punto de Entrega #${i}`,
      service_time_min: serviceTime
    });
  }

  updateOrdersUI();
}

function updateOrdersUI() {
  renderOrdersOnMap(state.orders);

  const container = document.getElementById("order-list-items");
  container.innerHTML = "";

  document.getElementById("order-count-badge").innerText = `${state.orders.length} órdenes`;

  state.orders.forEach((o, idx) => {
    const item = document.createElement("div");
    item.className = "order-item";
    item.innerHTML = `
      <div>
        <strong>#${idx + 1}</strong> <span style="color:#cbd5e1">${o.address}</span>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem">
        <span style="font-size:0.75rem; color:#94a3b8">${o.service_time_min}m</span>
        <span class="order-delete" onclick="removeOrder(${idx})">&times;</span>
      </div>
    `;
    container.appendChild(item);
  });

  const runBtn = document.getElementById("btn-run-simulation");
  runBtn.disabled = state.orders.length === 0;
}

// Ejecutar optimización y comparación
async function runSimulation() {
  if (state.orders.length === 0) return;

  const btn = document.getElementById("btn-run-simulation");
  btn.innerText = "⏳ Consultando Overpass & Optimizando...";
  btn.disabled = true;

  const shiftHours = parseFloat(document.getElementById("input-shift-hours").value) || 8.0;
  const serviceTime = parseFloat(document.getElementById("input-service-time").value) || 12.0;

  // Actualizar tiempos de servicio en las órdenes
  state.orders.forEach(o => o.service_time_min = serviceTime);

  const payload = {
    hub: state.hub,
    orders: state.orders,
    shift: {
      max_hours: shiftHours,
      service_time_per_order_min: serviceTime,
      buffer_time_min: 15.0
    }
  };

  try {
    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Error en simulación: ${err.detail || "Error desconocido"}`);
      return;
    }

    const data = await res.json();
    renderSimulationResults(data);
  } catch (e) {
    alert("Error al comunicarse con el servidor de optimización.");
  } finally {
    btn.innerText = "🚀 Iniciar Simulación y Comparación";
    btn.disabled = false;
  }
}

function renderSimulationResults(data) {
  const panel = document.getElementById("results-panel");
  panel.classList.add("active");

  const results = data.results;

  // Renderizar tarjetas de métricas
  renderAlgoCard("ga", results.GA, data.best_algorithm_by_distance === "GA");
  renderAlgoCard("pso", results.PSO, data.best_algorithm_by_distance === "PSO");
  renderAlgoCard("aco", results.ACO, data.best_algorithm_by_distance === "ACO");

  // Trazar rutas en el mapa
  clearRoutes();
  drawRoute(routeLayerGA, results.GA.route_polyline, "#0ea5e9", 4);
  drawRoute(routeLayerPSO, results.PSO.route_polyline, "#10b981", 4, "6, 6");
  drawRoute(routeLayerACO, results.ACO.route_polyline, "#f59e0b", 3, "2, 6");

  // Gráfica de convergencia con Chart.js
  renderConvergenceChart(results);
}

function renderAlgoCard(id, res, isWinner) {
  const card = document.getElementById(`card-${id}`);
  card.innerHTML = `
    <h4>
      ${res.name}
      ${isWinner ? '<span class="badge-winner">Mejor Distancia</span>' : ''}
    </h4>
    <div class="metric-row">
      <span>Órdenes entregadas:</span>
      <span class="metric-val" style="color: ${res.orders_dropped > 0 ? '#fbbf24' : '#34d399'}">
        ${res.orders_delivered} / ${res.orders_delivered + res.orders_dropped}
      </span>
    </div>
    <div class="metric-row">
      <span>Distancia total:</span>
      <span class="metric-val">${res.total_distance_km} km</span>
    </div>
    <div class="metric-row">
      <span>Tiempo total (jornada):</span>
      <span class="metric-val">${res.total_time_hours} hrs</span>
    </div>
    <div class="metric-row">
      <span>Conducción / Servicio:</span>
      <span class="metric-val">${res.driving_time_hours}h / ${res.service_time_hours}h</span>
    </div>
    <div class="metric-row">
      <span>Tiempo de cómputo:</span>
      <span class="metric-val">${res.execution_time_sec}s</span>
    </div>
  `;
}

function renderConvergenceChart(results) {
  const ctx = document.getElementById("chart-convergence").getContext("2d");

  const gaData = results.GA.convergence_curve;
  const psoData = results.PSO.convergence_curve;
  const acoData = results.ACO.convergence_curve;

  const maxLen = Math.max(gaData.length, psoData.length, acoData.length);
  const labels = Array.from({ length: maxLen }, (_, i) => i + 1);

  if (state.convergenceChart) {
    state.convergenceChart.destroy();
  }

  state.convergenceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "GA (Genético)",
          data: gaData,
          borderColor: "#0ea5e9",
          backgroundColor: "rgba(14, 165, 233, 0.1)",
          borderWidth: 2,
          pointRadius: 0
        },
        {
          label: "PSO (Enjambre)",
          data: psoData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2,
          pointRadius: 0
        },
        {
          label: "ACO (Hormigas)",
          data: acoData,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          borderWidth: 2,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#cbd5e1", font: { size: 10 } }
        },
        title: {
          display: true,
          text: "Convergencia de Coste por Generación / Iteración",
          color: "#94a3b8",
          font: { size: 11 }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Iteraciones", color: "#64748b", font: { size: 9 } },
          ticks: { color: "#64748b" },
          grid: { color: "#334155" }
        },
        y: {
          title: { display: true, text: "Coste (Distancia + Penalización)", color: "#64748b", font: { size: 9 } },
          ticks: { color: "#64748b" },
          grid: { color: "#334155" }
        }
      }
    }
  });
}
