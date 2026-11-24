const state = {
  hub: { name: "Estación de Entrega Norte (Monterrey)", lat: 25.7250, lon: -100.3130 },
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
  document.getElementById("header-hub-name").innerText = state.hub.name.split(",")[0].replace("Estación de Entrega ", "").replace("Centro de Distribución ", "");
  document.getElementById("header-shift-label").innerText = `${state.shift.max_hours.toFixed(1)} hrs`;
}

window.onHubMoved = async (lat, lon) => {
  state.hub.lat = lat;
  state.hub.lon = lon;

  try {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const data = await res.json();
      state.hub.name = `Estación (${data.display_name.split(",").slice(0, 2).join(",")})`;
    }
  } catch (e) {
    state.hub.name = `Estación (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  }

  updateHeaderAndHubUI();
};

window.onMapClicked = async (lat, lon) => {
  let display = `Dirección en (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
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
    alert("Error de conexión al geocodificar la dirección.");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function addOrder(lat, lon, address = "") {
  const serviceTime = parseFloat(document.getElementById("input-service-time").value) || 12.0;
  const trackingNumber = `TBA-${Math.floor(100000 + Math.random() * 900000)}`;
  const packageTypes = ["Caja estándar", "Sobre acolchado", "Paquete prioritario", "Caja mediana"];
  const packageType = packageTypes[Math.floor(Math.random() * packageTypes.length)];

  const newOrder = {
    id: trackingNumber,
    lat: lat,
    lon: lon,
    address: address || `Destino ${state.orders.length + 1}`,
    package_type: packageType,
    service_time_min: serviceTime
  };
  state.orders.push(newOrder);
  updateOrdersUI();
}

function removeOrder(index) {
  state.orders.splice(index, 1);
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
  document.getElementById("dock-status-message").innerText = "Manifiesto vacío. Agregue paquetes para optimizar.";

  document.getElementById("pill-km-ga").innerText = "-- km";
  document.getElementById("pill-km-pso").innerText = "-- km";
  document.getElementById("pill-km-aco").innerText = "-- km";
}

function generateSampleOrders() {
  clearAllOrders();
  const baseLat = state.hub.lat;
  const baseLon = state.hub.lon;
  const serviceTime = parseFloat(document.getElementById("input-service-time").value) || 12.0;

  const SAMPLE_PACKAGES = [
    { address: "Av. Universidad 402, San Nicolás", latOffset: 0.015, lonOffset: 0.008, type: "Caja estándar" },
    { address: "Av. Manuel L. Barragán 1250, San Nicolás", latOffset: 0.022, lonOffset: -0.012, type: "Sobre acolchado" },
    { address: "Av. Fidel Velázquez 310, Monterrey Norte", latOffset: -0.018, lonOffset: -0.015, type: "Paquete prioritario" },
    { address: "Av. Rómulo Garza 240, San Nicolás", latOffset: 0.008, lonOffset: 0.028, type: "Caja mediana" },
    { address: "Av. Almazán 810, San Nicolás", latOffset: -0.012, lonOffset: -0.025, type: "Sobre acolchado" },
    { address: "Av. Sendero Divisorio 200, General Escobedo", latOffset: 0.038, lonOffset: -0.005, type: "Caja estándar" },
    { address: "Av. Raúl Salinas Lozano 540, General Escobedo", latOffset: 0.032, lonOffset: -0.032, type: "Paquete prioritario" },
    { address: "Av. Nogalar Sur 1100, San Nicolás", latOffset: -0.005, lonOffset: 0.016, type: "Caja voluminosa" },
    { address: "Av. Benito Juárez 320, San Nicolás Centro", latOffset: 0.018, lonOffset: 0.022, type: "Caja estándar" },
    { address: "Av. Churubusco 900, Monterrey", latOffset: -0.028, lonOffset: 0.012, type: "Sobre acolchado" }
  ];

  SAMPLE_PACKAGES.forEach((p, idx) => {
    state.orders.push({
      id: `TBA-${840000 + (idx + 1) * 1153}`,
      lat: baseLat + p.latOffset,
      lon: baseLon + p.lonOffset,
      address: p.address,
      package_type: p.type,
      service_time_min: serviceTime
    });
  });

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
  headerCount.innerText = `${state.orders.length} paquetes`;

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
    const pkgType = o.package_type || "Caja estándar";

    li.innerHTML = `
      <div class="order-badge-num font-mono">${label}</div>
      <div class="order-main-info">
        <div class="order-tracking-tag font-mono">
          <span class="tracking-code">${o.id}</span>
          <span class="package-type-pill">${pkgType}</span>
        </div>
        <div class="order-address-text" title="${o.address}">${o.address}</div>
        <div class="order-meta-text font-mono">${o.lat.toFixed(4)}, ${o.lon.toFixed(4)} · ${o.service_time_min}m en puerta</div>
      </div>
      <button type="button" class="order-delete-btn" onclick="removeOrder(${idx})" aria-label="Eliminar paquete ${idx + 1}">&times;</button>
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
  statusDock.innerText = "Calculando ruta óptima con GA, PSO y ACO...";

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
  document.getElementById("stat-fulfillment").innerText = `${bestRes.orders_delivered} de ${bestRes.orders_delivered + bestRes.orders_dropped} entregados`;

  document.getElementById("dock-status-message").innerText = `Ruta óptima: ${bestAlgo} (${bestRes.total_distance_km} km en ${bestRes.total_time_hours} hrs)`;

  renderSideMetricCard("side-card-ga", results.GA, bestAlgo === "GA");
  renderSideMetricCard("side-card-pso", results.PSO, bestAlgo === "PSO");
  renderSideMetricCard("side-card-aco", results.ACO, bestAlgo === "ACO");

  document.getElementById("pill-km-ga").innerText = `${results.GA.total_distance_km} km`;
  document.getElementById("pill-km-pso").innerText = `${results.PSO.total_distance_km} km`;
  document.getElementById("pill-km-aco").innerText = `${results.ACO.total_distance_km} km`;

  clearRoutes();
  drawRoute(routeLayerGA, results.GA.route_polyline, "#38BDF8", 2.8);
  drawRoute(routeLayerPSO, results.PSO.route_polyline, "#34D399", 2.8, "5, 5");
  drawRoute(routeLayerACO, results.ACO.route_polyline, "#F59E0B", 2.8, "2, 5");

  renderConvergenceChart(results);
  renderScheduleTimeline(bestRes);

  switchTab("results");
}

function renderSideMetricCard(containerId, res, isOptimal) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="card-top">
      <span class="card-algo-name">${res.name}</span>
      ${isOptimal ? '<span class="badge-winner font-mono">ÓPTIMO PARA FLOTA</span>' : ''}
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
        <span class="m-label">Cumplimiento</span>
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
          label: "Genético (GA)",
          data: gaData,
          borderColor: "#38BDF8",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0
        },
        {
          label: "Enjambre (PSO)",
          data: psoData,
          borderColor: "#34D399",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0
        },
        {
          label: "Hormigas (ACO)",
          data: acoData,
          borderColor: "#F59E0B",
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
            color: "#9CA3AF",
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            boxWidth: 10
          }
        }
      },
      scales: {
        x: {
          title: { display: false },
          ticks: { color: "#6B7280", font: { family: "'JetBrains Mono', monospace", size: 8 } },
          grid: { color: "rgba(255, 255, 255, 0.05)" }
        },
        y: {
          title: { display: false },
          ticks: { color: "#6B7280", font: { family: "'JetBrains Mono', monospace", size: 8 } },
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
    <span class="timeline-desc">Salida de Estación (${state.hub.name.split(",")[0]})</span>
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
    const tracking = stop.order_id || `TBA-${840000 + (i + 1) * 1153}`;

    item.innerHTML = `
      <span class="timeline-time">${timeFormatted}</span>
      <span class="timeline-desc">#${num} ${tracking}: ${stop.address}</span>
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
    <span class="timeline-desc">Retorno a Estación (${state.hub.name.split(",")[0]})</span>
    <span class="timeline-dist">${bestRes.total_distance_km} km</span>
  `;
  container.appendChild(endItem);
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO DE GUÍA DE USO (Sólo se abre por acción del usuario)
   ═══════════════════════════════════════════════════════════════ */

const TOUR_STEPS = [
  {
    step: 1,
    title: "Paso 1: Estación de Entrega (Hub) y Reubicación",
    desc: "El marcador rojo en el mapa señala tu base de operaciones y almacén. <strong>Puedes hacer clic y arrastrar el símbolo de la estación a cualquier dirección o colonia de la ciudad</strong>; al soltarlo, se recalculan automáticamente las distancias viales.",
    tab: "params",
    highlightHub: true
  },
  {
    step: 2,
    title: "Paso 2: Manifiesto de Paquetes y Guías de Envío",
    desc: "Ingresa los domicilios de entrega de tus clientes. Puedes registrar guías escribiendo una dirección en la barra de búsqueda, haciendo clic directamente en cualquier calle del mapa o cargando el lote de prueba con 10 paquetes en Monterrey.",
    tab: "orders",
    highlightHub: false
  },
  {
    step: 3,
    title: "Paso 3: Ventana Laboral y Restricciones de Turno",
    desc: "Configura el límite de horas del repartidor (ej. 8.0 hrs), el tiempo promedio de atención en puerta por paquete (12 min) y el buffer de retorno a la estación (15 min). La optimización descarta paradas que comprometan el regreso a tiempo al almacén.",
    tab: "params",
    highlightHub: false
  },
  {
    step: 4,
    title: "Paso 4: Algoritmos de Ruteo de Flotas (GA · PSO · ACO)",
    desc: "Al presionar <strong>'Optimizar Ruta y Asignar Turno'</strong>, Cursus descarga la red vial real con límites de velocidad vía Overpass API, resolviendo caminos mínimos con Dijkstra y optimizando la secuencia mediante Algoritmos Genéticos, Enjambre y Hormigas en paralelo.",
    tab: "orders",
    highlightHub: false
  },
  {
    step: 5,
    title: "Paso 5: Hoja de Ruta del Conductor y Métricas",
    desc: "La pestaña de <strong>Métricas de Entrega</strong> presenta el algoritmo con menor kilometraje y consumo, la curva de convergencia y la hoja de ruta cronológica paso a paso con horario exacto de llegada a cada cliente y retorno a la estación.",
    tab: "results",
    highlightHub: false
  }
];

let currentTourIndex = -1;

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

  // NO abrir automáticamente al cargar la página: queda 100% bajo control del usuario
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
  if (typeof highlightHubMarker === "function") {
    highlightHubMarker(false);
  }
}

function setTourStep(index) {
  currentTourIndex = index;
  document.getElementById("tutorial-card-welcome").style.display = "none";
  document.getElementById("tutorial-card-step").style.display = "block";

  const stepData = TOUR_STEPS[index];
  document.getElementById("tut-step-badge").innerText = `Paso ${stepData.step} de ${TOUR_STEPS.length}`;
  document.getElementById("tut-step-title").innerText = stepData.title;
  document.getElementById("tut-step-desc").innerHTML = stepData.desc;

  if (stepData.tab) {
    switchTab(stepData.tab);
  }

  if (typeof highlightHubMarker === "function") {
    highlightHubMarker(stepData.highlightHub);
  }

  // Actualizar barras de paso
  const bars = document.querySelectorAll("#tut-steps-bar .step-indicator-bar");
  bars.forEach((bar, idx) => {
    bar.classList.toggle("active", idx <= index);
  });

  // Actualizar textos de botones de navegación
  const nextBtn = document.getElementById("btn-tour-next");
  if (index === TOUR_STEPS.length - 1) {
    nextBtn.innerText = "Finalizar";
  } else {
    nextBtn.innerText = "Siguiente";
  }

  const prevBtn = document.getElementById("btn-tour-prev");
  if (index === 0) {
    prevBtn.innerText = "Inicio";
  } else {
    prevBtn.innerText = "Anterior";
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
