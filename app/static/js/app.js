const state = {
  hub: { name: "Centro de Distribución Cursus Norte", lat: 25.7250, lon: -100.3130 },
  orders: [],
  shift: { max_hours: 8.0, service_time_per_order_min: 12.0, buffer_time_min: 15.0 },
  convergenceChart: null
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      state.hub = data.hub;
      state.shift = data.shift;
    }
  } catch (e) {
    console.warn("Error cargando configuración remota. Utilizando valores locales.", e);
  }

  document.getElementById("hub-coords").innerText = `${state.hub.lat.toFixed(4)}, ${state.hub.lon.toFixed(4)}`;
  document.getElementById("hub-name").innerText = state.hub.name;

  initMap(state.hub.lat, state.hub.lon);

  // Formularios y botones
  document.getElementById("btn-add-address").addEventListener("click", handleAddAddress);
  document.getElementById("input-address").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleAddAddress();
  });
  document.getElementById("btn-sample-orders").addEventListener("click", generateSampleOrders);
  document.getElementById("btn-clear-orders").addEventListener("click", clearAllOrders);
  document.getElementById("btn-run-simulation").addEventListener("click", runSimulation);
  document.getElementById("btn-close-results").addEventListener("click", () => {
    document.getElementById("results-panel").classList.remove("active");
  });

  // Capas
  document.getElementById("toggle-ga").addEventListener("change", (e) => toggleRouteLayer("GA", e.target.checked));
  document.getElementById("toggle-pso").addEventListener("change", (e) => toggleRouteLayer("PSO", e.target.checked));
  document.getElementById("toggle-aco").addEventListener("change", (e) => toggleRouteLayer("ACO", e.target.checked));

  generateSampleOrders();
});

window.onHubMoved = async (lat, lon) => {
  state.hub.lat = lat;
  state.hub.lon = lon;
  document.getElementById("hub-coords").innerText = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  try {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const data = await res.json();
      state.hub.name = data.display_name;
      document.getElementById("hub-name").innerText = data.display_name;
    }
  } catch (e) {
    state.hub.name = `Base (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    document.getElementById("hub-name").innerText = state.hub.name;
  }
};

window.onMapClicked = async (lat, lon) => {
  let display = `Punto (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  try {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const data = await res.json();
      if (data.display_name) {
        display = data.display_name.split(",").slice(0, 3).join(",");
      }
    }
  } catch (e) {
    // Mantener etiqueta de coordenadas
  }

  addOrder(lat, lon, display);
};

async function handleAddAddress() {
  const input = document.getElementById("input-address");
  const address = input.value.trim();
  if (!address) return;

  const btn = document.getElementById("btn-add-address");
  const originalText = btn.innerText;
  btn.innerText = "Consultando...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });

    if (!res.ok) {
      alert("No se encontró la dirección en OpenStreetMap.");
      return;
    }

    const data = await res.json();
    addOrder(data.lat, data.lon, data.display_name.split(",").slice(0, 3).join(","));
    input.value = "";
  } catch (e) {
    alert("Error de conexión al geocodificar.");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function addOrder(lat, lon, address = "") {
  const serviceTime = parseFloat(document.getElementById("input-service-time").value) || 12.0;
  const newOrder = {
    id: `ORD-${state.orders.length + 1}`,
    lat: lat,
    lon: lon,
    address: address || `Orden ${state.orders.length + 1}`,
    service_time_min: serviceTime
  };
  state.orders.push(newOrder);
  updateOrdersUI();
}

function removeOrder(index) {
  state.orders.splice(index, 1);
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
  const count = 10;
  const serviceTime = parseFloat(document.getElementById("input-service-time").value) || 12.0;

  for (let i = 1; i <= count; i++) {
    const angle = (i * 2 * Math.PI) / count + (Math.random() * 0.3 - 0.15);
    const radius = 0.018 + Math.random() * 0.032;
    const lat = baseLat + radius * Math.cos(angle);
    const lon = baseLon + radius * Math.sin(angle) * 1.15;

    state.orders.push({
      id: `ORD-${i}`,
      lat: lat,
      lon: lon,
      address: `Destino ${i}`,
      service_time_min: serviceTime
    });
  }

  updateOrdersUI();
}

function updateOrdersUI() {
  renderOrdersOnMap(state.orders);

  const container = document.getElementById("order-list-items");
  const emptyState = document.getElementById("order-empty-state");
  const badge = document.getElementById("order-count-badge");
  const runBtn = document.getElementById("btn-run-simulation");

  container.innerHTML = "";
  badge.innerText = `${state.orders.length} órdenes`;

  if (state.orders.length === 0) {
    emptyState.style.display = "flex";
    runBtn.disabled = true;
    return;
  }

  emptyState.style.display = "none";
  runBtn.disabled = false;

  state.orders.forEach((o, idx) => {
    const li = document.createElement("li");
    li.className = "order-row";
    li.innerHTML = `
      <span class="order-row-index">${idx + 1}</span>
      <span class="order-row-address" title="${o.address}">${o.address}</span>
      <div class="order-row-meta">
        <span class="order-time-tag">${o.service_time_min}m</span>
        <button type="button" class="order-remove-btn" onclick="removeOrder(${idx})" aria-label="Eliminar orden ${idx + 1}">&times;</button>
      </div>
    `;
    container.appendChild(li);
  });
}

async function runSimulation() {
  if (state.orders.length === 0) return;

  const btn = document.getElementById("btn-run-simulation");
  const originalText = btn.innerText;
  btn.innerText = "Consultando red vial y ejecutando optimización...";
  btn.disabled = true;

  const shiftHours = parseFloat(document.getElementById("input-shift-hours").value) || 8.0;
  const serviceTime = parseFloat(document.getElementById("input-service-time").value) || 12.0;

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
      alert(`Error en la optimización: ${err.detail || "Error no especificado"}`);
      return;
    }

    const data = await res.json();
    renderSimulationResults(data);
  } catch (e) {
    alert("Fallo de comunicación con el motor de optimización.");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function renderSimulationResults(data) {
  const panel = document.getElementById("results-panel");
  panel.classList.add("active");

  const results = data.results;

  renderAlgoCard("card-ga", results.GA, data.best_algorithm_by_distance === "GA");
  renderAlgoCard("card-pso", results.PSO, data.best_algorithm_by_distance === "PSO");
  renderAlgoCard("card-aco", results.ACO, data.best_algorithm_by_distance === "ACO");

  clearRoutes();
  drawRoute(routeLayerGA, results.GA.route_polyline, "#0284c7", 3.5);
  drawRoute(routeLayerPSO, results.PSO.route_polyline, "#059669", 3.5, "6, 6");
  drawRoute(routeLayerACO, results.ACO.route_polyline, "#d97706", 3.5, "2, 6");

  renderConvergenceChart(results);
}

function renderAlgoCard(containerId, res, isOptimal) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="card-title-row">
      <span class="card-title">${res.name}</span>
      ${isOptimal ? '<span class="badge-optimal">Menor Distancia</span>' : ''}
    </div>
    <div class="metric-line">
      <span>Órdenes completadas:</span>
      <span class="metric-data">${res.orders_delivered} de ${res.orders_delivered + res.orders_dropped}</span>
    </div>
    <div class="metric-line">
      <span>Distancia de ruta:</span>
      <span class="metric-data">${res.total_distance_km} km</span>
    </div>
    <div class="metric-line">
      <span>Duración estimada:</span>
      <span class="metric-data">${res.total_time_hours} hrs</span>
    </div>
    <div class="metric-line">
      <span>Manejo / Atención:</span>
      <span class="metric-data">${res.driving_time_hours}h / ${res.service_time_hours}h</span>
    </div>
    <div class="metric-line">
      <span>Tiempo de cómputo:</span>
      <span class="metric-data">${res.execution_time_sec} s</span>
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
          label: "GA",
          data: gaData,
          borderColor: "#0284c7",
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 0
        },
        {
          label: "PSO",
          data: psoData,
          borderColor: "#059669",
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 0
        },
        {
          label: "ACO",
          data: acoData,
          borderColor: "#d97706",
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#cbd5e1", font: { size: 10 } }
        },
        title: {
          display: true,
          text: "Convergencia de Función Objetivo (Distancia y Penalización)",
          color: "#9ca3af",
          font: { size: 11, weight: "bold" }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Iteración", color: "#64748b", font: { size: 9 } },
          ticks: { color: "#64748b" },
          grid: { color: "#252f44" }
        },
        y: {
          title: { display: true, text: "Valor de Coste", color: "#64748b", font: { size: 9 } },
          ticks: { color: "#64748b" },
          grid: { color: "#252f44" }
        }
      }
    }
  });
}
