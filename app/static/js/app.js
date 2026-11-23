const state = {
  hub: { name: "Centro de Distribución Cursus Norte", lat: 25.7250, lon: -100.3130 },
  orders: [],
  shift: { max_hours: 8.0, service_time_per_order_min: 12.0, buffer_time_min: 15.0 },
  results: null,
  convergenceChart: null
};

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();

  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      state.hub = data.hub;
      state.shift = data.shift;
    }
  } catch (e) {
    console.warn("Utilizando configuración local de respaldo.", e);
  }

  updateHeaderAndHubUI();
  initMap(state.hub.lat, state.hub.lon);

  document.getElementById("btn-add-address").addEventListener("click", handleAddAddress);
  document.getElementById("input-address").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleAddAddress();
  });
  document.getElementById("btn-sample-orders").addEventListener("click", generateSampleOrders);
  document.getElementById("btn-clear-orders").addEventListener("click", clearAllOrders);
  document.getElementById("btn-run-simulation").addEventListener("click", runSimulation);
  document.getElementById("btn-dock-view-metrics").addEventListener("click", () => switchTab("results"));

  document.getElementById("input-shift-hours").addEventListener("change", (e) => {
    state.shift.max_hours = parseFloat(e.target.value) || 8.0;
    updateHeaderAndHubUI();
  });
  document.getElementById("input-service-time").addEventListener("change", (e) => {
    state.shift.service_time_per_order_min = parseFloat(e.target.value) || 12.0;
  });
  document.getElementById("input-buffer-time").addEventListener("change", (e) => {
    state.shift.buffer_time_min = parseFloat(e.target.value) || 15.0;
  });

  document.getElementById("toggle-ga").addEventListener("change", (e) => toggleRouteLayer("GA", e.target.checked));
  document.getElementById("toggle-pso").addEventListener("change", (e) => toggleRouteLayer("PSO", e.target.checked));
  document.getElementById("toggle-aco").addEventListener("change", (e) => toggleRouteLayer("ACO", e.target.checked));

  generateSampleOrders();
  initTutorial();
});

function setupTabs() {
  const tabs = [
    { btn: "tab-btn-orders", pane: "tab-content-orders", name: "orders" },
    { btn: "tab-btn-params", pane: "tab-content-params", name: "params" },
    { btn: "tab-btn-results", pane: "tab-content-results", name: "results" }
  ];

  tabs.forEach(t => {
    document.getElementById(t.btn).addEventListener("click", () => switchTab(t.name));
  });
}

function switchTab(tabName) {
  const tabs = [
    { btn: "tab-btn-orders", pane: "tab-content-orders", name: "orders" },
    { btn: "tab-btn-params", pane: "tab-content-params", name: "params" },
    { btn: "tab-btn-results", pane: "tab-content-results", name: "results" }
  ];

  tabs.forEach(t => {
    const isTarget = t.name === tabName;
    document.getElementById(t.btn).classList.toggle("active", isTarget);
    document.getElementById(t.btn).setAttribute("aria-selected", isTarget ? "true" : "false");
    document.getElementById(t.pane).classList.toggle("active", isTarget);
  });
}

function updateHeaderAndHubUI() {
  document.getElementById("hub-coords").innerText = `${state.hub.lat.toFixed(4)}, ${state.hub.lon.toFixed(4)}`;
  document.getElementById("hub-name").innerText = state.hub.name;
  document.getElementById("header-hub-name").innerText = state.hub.name.split(",")[0];
  document.getElementById("header-shift-label").innerText = `${state.shift.max_hours.toFixed(1)} hrs`;
}

window.onHubMoved = async (lat, lon) => {
  state.hub.lat = lat;
  state.hub.lon = lon;

  try {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const data = await res.json();
      state.hub.name = data.display_name;
    }
  } catch (e) {
    state.hub.name = `Base (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  }

  updateHeaderAndHubUI();
};

window.onMapClicked = async (lat, lon) => {
  let display = `Parada (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
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
    address: address || `Parada ${state.orders.length + 1}`,
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
  state.results = null;
  clearRoutes();
  updateOrdersUI();

  document.getElementById("results-empty-notice").style.display = "flex";
  document.getElementById("results-content").style.display = "none";
  document.getElementById("btn-dock-view-metrics").style.display = "none";
  document.getElementById("dock-status-message").innerText = "Cola vacía. Ingrese órdenes para optimizar.";

  document.getElementById("pill-km-ga").innerText = "-- km";
  document.getElementById("pill-km-pso").innerText = "-- km";
  document.getElementById("pill-km-aco").innerText = "-- km";
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
      address: `Parada ${i}: Sector ${String.fromCharCode(64 + i)}`,
      service_time_min: serviceTime
    });
  }

  updateOrdersUI();
}

function updateOrdersUI() {
  renderOrdersOnMap(state.orders);

  const container = document.getElementById("order-list-items");
  const emptyState = document.getElementById("order-empty-state");
  const countBadge = document.getElementById("tab-orders-badge");
  const headerCount = document.getElementById("header-orders-count");
  const runBtn = document.getElementById("btn-run-simulation");

  container.innerHTML = "";
  countBadge.innerText = state.orders.length;
  headerCount.innerText = state.orders.length;

  if (state.orders.length === 0) {
    emptyState.style.display = "flex";
    runBtn.disabled = true;
    return;
  }

  emptyState.style.display = "none";
  runBtn.disabled = false;

  state.orders.forEach((o, idx) => {
    const li = document.createElement("li");
    li.className = "order-card-row";
    const label = (idx + 1) < 10 ? `0${idx + 1}` : `${idx + 1}`;

    li.innerHTML = `
      <div class="order-badge-num font-mono">${label}</div>
      <div class="order-main-info">
        <div class="order-address-text" title="${o.address}">${o.address}</div>
        <div class="order-meta-text font-mono">${o.lat.toFixed(4)}, ${o.lon.toFixed(4)} · ${o.service_time_min}m entrega</div>
      </div>
      <button type="button" class="order-delete-btn" onclick="removeOrder(${idx})" aria-label="Eliminar orden ${idx + 1}">&times;</button>
    `;
    container.appendChild(li);
  });
}

async function runSimulation() {
  if (state.orders.length === 0) return;

  const btn = document.getElementById("btn-run-simulation");
  const originalText = btn.innerText;
  btn.innerText = "Descargando red vial y optimizando...";
  btn.disabled = true;

  const statusDock = document.getElementById("dock-status-message");
  statusDock.innerText = "Ejecutando GA, PSO y ACO con restricciones de jornada...";

  const shiftHours = parseFloat(document.getElementById("input-shift-hours").value) || 8.0;
  const serviceTime = parseFloat(document.getElementById("input-service-time").value) || 12.0;
  const bufferTime = parseFloat(document.getElementById("input-buffer-time").value) || 15.0;

  state.orders.forEach(o => o.service_time_min = serviceTime);

  const payload = {
    hub: state.hub,
    orders: state.orders,
    shift: {
      max_hours: shiftHours,
      service_time_per_order_min: serviceTime,
      buffer_time_min: bufferTime
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
    state.results = data;
    renderSimulationResults(data);
  } catch (e) {
    alert("Fallo de comunicación con el motor de optimización.");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function renderSimulationResults(data) {
  const results = data.results;

  document.getElementById("results-empty-notice").style.display = "none";
  document.getElementById("results-content").style.display = "block";
  document.getElementById("btn-dock-view-metrics").style.display = "inline-flex";

  const bestAlgo = data.best_algorithm_by_distance;
  const bestRes = results[bestAlgo];
  document.getElementById("stat-best-distance").innerText = `${bestAlgo} (${bestRes.total_distance_km} km)`;
  document.getElementById("stat-fulfillment").innerText = `${bestRes.orders_delivered} de ${bestRes.orders_delivered + bestRes.orders_dropped} órdenes`;

  document.getElementById("dock-status-message").innerText = `Ruta óptima: ${bestAlgo} con ${bestRes.total_distance_km} km en ${bestRes.total_time_hours} hrs`;

  renderSideMetricCard("side-card-ga", results.GA, bestAlgo === "GA");
  renderSideMetricCard("side-card-pso", results.PSO, bestAlgo === "PSO");
  renderSideMetricCard("side-card-aco", results.ACO, bestAlgo === "ACO");

  document.getElementById("pill-km-ga").innerText = `${results.GA.total_distance_km} km`;
  document.getElementById("pill-km-pso").innerText = `${results.PSO.total_distance_km} km`;
  document.getElementById("pill-km-aco").innerText = `${results.ACO.total_distance_km} km`;

  clearRoutes();
  drawRoute(routeLayerGA, results.GA.route_polyline, "#38BDF8", 3.2);
  drawRoute(routeLayerPSO, results.PSO.route_polyline, "#34D399", 3.2, "6, 6");
  drawRoute(routeLayerACO, results.ACO.route_polyline, "#FBBF24", 3.2, "2, 6");

  renderConvergenceChart(results);
  renderScheduleTimeline(bestRes);

  switchTab("results");
}

function renderSideMetricCard(containerId, res, isOptimal) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="card-top">
      <span class="card-algo-name">${res.name}</span>
      ${isOptimal ? '<span class="badge-winner font-mono">ÓPTIMO</span>' : ''}
    </div>
    <div class="metric-grid-2x2 font-mono">
      <div class="m-item">
        <span class="m-label">Distancia</span>
        <span class="m-data">${res.total_distance_km} km</span>
      </div>
      <div class="m-item">
        <span class="m-label">Tiempo Total</span>
        <span class="m-data">${res.total_time_hours} hrs</span>
      </div>
      <div class="m-item">
        <span class="m-label">Entregadas</span>
        <span class="m-data">${res.orders_delivered} / ${res.orders_delivered + res.orders_dropped}</span>
      </div>
      <div class="m-item">
        <span class="m-label">Cómputo</span>
        <span class="m-data">${res.execution_time_sec} s</span>
      </div>
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
          borderColor: "#38BDF8",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0
        },
        {
          label: "PSO",
          data: psoData,
          borderColor: "#34D399",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0
        },
        {
          label: "ACO",
          data: acoData,
          borderColor: "#FBBF24",
          backgroundColor: "transparent",
          borderWidth: 1.5,
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
          labels: {
            color: "#8E9299",
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            boxWidth: 10
          }
        }
      },
      scales: {
        x: {
          title: { display: false },
          ticks: { color: "#5A5E66", font: { family: "'JetBrains Mono', monospace", size: 8 } },
          grid: { color: "rgba(255, 255, 255, 0.05)" }
        },
        y: {
          title: { display: false },
          ticks: { color: "#5A5E66", font: { family: "'JetBrains Mono', monospace", size: 8 } },
          grid: { color: "rgba(255, 255, 255, 0.05)" }
        }
      }
    }
  });
}

function renderScheduleTimeline(bestRes) {
  const container = document.getElementById("schedule-timeline");
  container.innerHTML = "";

  const startItem = document.createElement("div");
  startItem.className = "timeline-item";
  startItem.innerHTML = `
    <span class="timeline-time">00:00</span>
    <span class="timeline-desc">Salida de Base (${state.hub.name.split(",")[0]})</span>
    <span class="timeline-dist">0.0 km</span>
  `;
  container.appendChild(startItem);

  bestRes.stops.forEach((stop, i) => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    const hours = Math.floor(stop.arrival_time_min / 60);
    const mins = Math.floor(stop.arrival_time_min % 60);
    const timeFormatted = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;

    item.innerHTML = `
      <span class="timeline-time">${timeFormatted}</span>
      <span class="timeline-desc">#${num} ${stop.address}</span>
      <span class="timeline-dist">+${stop.distance_from_prev_km} km</span>
    `;
    container.appendChild(item);
  });

  const endItem = document.createElement("div");
  endItem.className = "timeline-item";
  const totalMin = bestRes.total_time_hours * 60;
  const endH = Math.floor(totalMin / 60);
  const endM = Math.floor(totalMin % 60);
  endItem.innerHTML = `
    <span class="timeline-time">${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}</span>
    <span class="timeline-desc">Retorno a Base (${state.hub.name.split(",")[0]})</span>
    <span class="timeline-dist">${bestRes.total_distance_km} km</span>
  `;
  container.appendChild(endItem);
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO TUTORIAL // Patrón Autumn-Solara
   ═══════════════════════════════════════════════════════════════ */

const TOUR_STEPS = [
  {
    step: 1,
    title: "Paso 1: Centro de Distribución y Reubicación",
    desc: "El marcador rojo con halo técnico en el mapa señala tu base de operaciones. <strong>Puedes hacer clic y arrastrar el símbolo rojo a cualquier dirección o colonia de la ciudad</strong>; al soltarlo, Cursus geocodifica automáticamente la nueva calle y reconfigura la matriz de distancias.",
    tab: "params",
    highlightHub: true
  },
  {
    step: 2,
    title: "Paso 2: Registro de Órdenes y Geocodificación",
    desc: "Agrega paradas de entrega de tres formas: haciendo clic directamente sobre cualquier calle del mapa interactivo, escribiendo una dirección en la barra de búsqueda o cargando las 10 paradas de prueba predefinidas en Monterrey.",
    tab: "orders",
    highlightHub: false
  },
  {
    step: 3,
    title: "Paso 3: Restricciones de Jornada Laboral",
    desc: "Establece el límite de horas de turno del repartidor (ej. 8.0 hrs), el tiempo de atención en cada domicilio (12 min) y el margen de regreso seguro a la base (15 min). Si la ruta total excede la jornada, el sistema penaliza y descarta las entregas inviables.",
    tab: "params",
    highlightHub: false
  },
  {
    step: 4,
    title: "Paso 4: Red Vial Real y Modelos (GA · PSO · ACO)",
    desc: "Al presionar el botón <strong>'Optimizar Ruta y Comparar Algoritmos'</strong>, Cursus descarga la topología vial con sentidos y velocidades vía Overpass API, resolviendo caminos mínimos con Dijkstra y optimizando la secuencia mediante Algoritmos Genéticos, Enjambre y Hormigas simultáneamente.",
    tab: "orders",
    highlightHub: false
  },
  {
    step: 5,
    title: "Paso 5: Métricas Comparativas y Hoja de Ruta",
    desc: "Al finalizar la optimización, la pestaña de <strong>Métricas</strong> despliega el algoritmo ganador, la curva de convergencia iterativa y el cronograma cronológico paso a paso con horario exacto de llegada a cada cliente y retorno seguro al Hub.",
    tab: "results",
    highlightHub: false
  }
];

let currentTourIndex = -1; // -1: Welcome card, 0 a 4: Pasos guiados

function initTutorial() {
  const openBtn = document.getElementById("btn-open-tutorial");
  const startBtn = document.getElementById("btn-start-tour");
  const skipBtn = document.getElementById("btn-skip-tour");
  const closeBtn = document.getElementById("btn-close-tour");
  const backdropDismiss = document.getElementById("tutorial-backdrop-dismiss");
  const prevBtn = document.getElementById("btn-tour-prev");
  const nextBtn = document.getElementById("btn-tour-next");

  if (openBtn) openBtn.addEventListener("click", () => openTutorial(true));
  if (startBtn) startBtn.addEventListener("click", () => setTourStep(0));
  if (skipBtn) skipBtn.addEventListener("click", closeTutorial);
  if (closeBtn) closeBtn.addEventListener("click", closeTutorial);
  if (backdropDismiss) backdropDismiss.addEventListener("click", closeTutorial);
  if (prevBtn) prevBtn.addEventListener("click", prevTourStep);
  if (nextBtn) nextBtn.addEventListener("click", nextTourStep);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const overlay = document.getElementById("tutorial-overlay");
      if (overlay && overlay.style.display !== "none") {
        closeTutorial();
      }
    }
  });

  // Apertura automática en primera visita
  if (!localStorage.getItem("cursus_tutorial_seen")) {
    setTimeout(() => {
      openTutorial(false);
    }, 400);
  }
}

function openTutorial(forceWelcome = true) {
  const overlay = document.getElementById("tutorial-overlay");
  if (!overlay) return;
  overlay.style.display = "flex";

  if (forceWelcome || currentTourIndex === -1) {
    currentTourIndex = -1;
    document.getElementById("tutorial-card-welcome").style.display = "block";
    document.getElementById("tutorial-card-step").style.display = "none";
    if (typeof highlightHubMarker === "function") {
      highlightHubMarker(false);
    }
  } else {
    setTourStep(currentTourIndex);
  }
}

function closeTutorial() {
  const overlay = document.getElementById("tutorial-overlay");
  if (overlay) overlay.style.display = "none";
  localStorage.setItem("cursus_tutorial_seen", "true");
  if (typeof highlightHubMarker === "function") {
    highlightHubMarker(false);
  }
}

function setTourStep(index) {
  currentTourIndex = index;
  document.getElementById("tutorial-card-welcome").style.display = "none";
  document.getElementById("tutorial-card-step").style.display = "block";

  const stepData = TOUR_STEPS[index];
  document.getElementById("tut-step-badge").innerText = `PASO ${stepData.step} DE ${TOUR_STEPS.length}`;
  document.getElementById("tut-step-title").innerText = stepData.title;
  document.getElementById("tut-step-desc").innerHTML = stepData.desc;

  if (stepData.tab) {
    switchTab(stepData.tab);
  }

  if (typeof highlightHubMarker === "function") {
    highlightHubMarker(stepData.highlightHub);
  }

  // Actualizar indicadores tipo cápsula
  const indicators = document.querySelectorAll("#tut-progress-indicators .indicator-dot");
  indicators.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === index);
  });

  // Actualizar textos de botones de navegación
  const nextBtn = document.getElementById("btn-tour-next");
  if (index === TOUR_STEPS.length - 1) {
    nextBtn.innerText = "¡Finalizar y Explorar!";
  } else {
    nextBtn.innerText = "Siguiente →";
  }

  const prevBtn = document.getElementById("btn-tour-prev");
  if (index === 0) {
    prevBtn.innerText = "← Inicio";
  } else {
    prevBtn.innerText = "← Anterior";
  }
}

function nextTourStep() {
  if (currentTourIndex < TOUR_STEPS.length - 1) {
    setTourStep(currentTourIndex + 1);
  } else {
    closeTutorial();
  }
}

function prevTourStep() {
  if (currentTourIndex > 0) {
    setTourStep(currentTourIndex - 1);
  } else {
    currentTourIndex = -1;
    document.getElementById("tutorial-card-welcome").style.display = "block";
    document.getElementById("tutorial-card-step").style.display = "none";
    if (typeof highlightHubMarker === "function") {
      highlightHubMarker(false);
    }
  }
}
