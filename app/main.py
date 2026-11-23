import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import (
    DEFAULT_HUB_NAME, DEFAULT_HUB_LAT, DEFAULT_HUB_LON,
    DEFAULT_SHIFT_HOURS, DEFAULT_SERVICE_TIME_MIN, DEFAULT_RETURN_BUFFER_MIN
)
from app.models.schemas import (
    OptimizationRequest, ComparisonResponse,
    GeocodeRequest, GeocodeResponse, HubConfig, ShiftConfig
)
from app.routing.geocoding import geocode_address, reverse_geocode
from app.routing.overpass import fetch_street_network
from app.routing.graph import RoadNetwork, build_cost_matrices
from app.algorithms.base import RouteEvaluator
from app.algorithms.genetic import run_genetic_algorithm
from app.algorithms.pso import run_pso_algorithm
from app.algorithms.aco import run_aco_algorithm

app = FastAPI(
    title="Cursus - Optimización de Despacho y Logística",
    description="Simulador de centro de distribución y comparador de metaheurísticas (GA, PSO, ACO)",
    version="1.0.0"
)

# Montar archivos estáticos
static_dir = os.path.join(os.path.dirname(__file__), "static")
templates_dir = os.path.join(os.path.dirname(__file__), "templates")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_home():
    """Entrega la interfaz principal de la aplicación."""
    index_path = os.path.join(templates_dir, "index.html")
    return FileResponse(index_path)

@app.get("/api/config")
def get_default_config():
    """Retorna los parámetros predeterminados del Hub y la jornada."""
    return {
        "hub": {
            "name": DEFAULT_HUB_NAME,
            "lat": DEFAULT_HUB_LAT,
            "lon": DEFAULT_HUB_LON
        },
        "shift": {
            "max_hours": DEFAULT_SHIFT_HOURS,
            "service_time_per_order_min": DEFAULT_SERVICE_TIME_MIN,
            "buffer_time_min": DEFAULT_RETURN_BUFFER_MIN
        }
    }

@app.post("/api/geocode", response_model=GeocodeResponse)
def api_geocode(request: GeocodeRequest):
    """Geocodifica una dirección escrita a coordenadas (lat, lon) mediante Nominatim."""
    result = geocode_address(request.address)
    if not result:
        raise HTTPException(status_code=404, detail="No se encontró la dirección especificada")
    return GeocodeResponse(
        address=request.address,
        lat=result["lat"],
        lon=result["lon"],
        display_name=result["display_name"]
    )

@app.get("/api/reverse-geocode")
def api_reverse_geocode(lat: float, lon: float):
    """Obtiene la dirección legible de un punto en el mapa."""
    name = reverse_geocode(lat, lon)
    return {"lat": lat, "lon": lon, "display_name": name}

@app.post("/api/optimize", response_model=ComparisonResponse)
def api_optimize(req: OptimizationRequest):
    """
    Ejecuta el ciclo completo de simulación:
    1. Construye el grafo vial sobre OpenStreetMap (Overpass API + Dijkstra).
    2. Genera matrices de distancia y tiempo reales.
    3. Evalúa la restricción de jornada laboral.
    4. Ejecuta GA, PSO y ACO bajo condiciones idénticas.
    """
    if len(req.orders) == 0:
        raise HTTPException(status_code=400, detail="Debe ingresar al menos una orden para optimizar.")

    hub_coord = (req.hub.lat, req.hub.lon)
    order_coords = [(o.lat, o.lon) for o in req.orders]
    all_coords = [hub_coord] + order_coords

    # Paso 1: Consultar red vial real
    road_network = RoadNetwork()
    osm_data = fetch_street_network(all_coords)
    if osm_data:
        road_network.build_from_overpass(osm_data)

    # Paso 2: Generar matrices de coste mediante caminos mínimos
    dist_matrix, time_matrix, path_geoms = build_cost_matrices(hub_coord, order_coords, road_network)

    # Paso 3: Inicializar evaluador con restricciones de jornada
    evaluator = RouteEvaluator(
        hub=req.hub,
        orders=req.orders,
        dist_matrix=dist_matrix,
        time_matrix=time_matrix,
        path_geometries=path_geoms,
        shift=req.shift
    )

    # Paso 4: Ejecutar metaheurísticas
    res_ga = run_genetic_algorithm(
        evaluator=evaluator,
        pop_size=req.params.ga_population_size,
        generations=req.params.ga_generations,
        cx_prob=req.params.ga_crossover_prob,
        mut_prob=req.params.ga_mutation_prob
    )

    res_pso = run_pso_algorithm(
        evaluator=evaluator,
        n_particles=req.params.pso_particles,
        iterations=req.params.pso_iterations,
        w=req.params.pso_w,
        c1=req.params.pso_c1,
        c2=req.params.pso_c2
    )

    res_aco = run_aco_algorithm(
        evaluator=evaluator,
        n_ants=req.params.aco_ants,
        iterations=req.params.aco_iterations,
        alpha=req.params.aco_alpha,
        beta=req.params.aco_beta,
        rho=req.params.aco_rho,
        q=req.params.aco_q
    )

    results_dict = {
        "GA": res_ga,
        "PSO": res_pso,
        "ACO": res_aco
    }

    # Determinar mejores algoritmos
    best_dist_algo = min(results_dict.keys(), key=lambda k: results_dict[k].total_distance_km)
    best_deliv_algo = max(results_dict.keys(), key=lambda k: results_dict[k].orders_delivered)

    return ComparisonResponse(
        hub=req.hub,
        total_orders_received=len(req.orders),
        shift_limit_hours=req.shift.max_hours,
        results=results_dict,
        best_algorithm_by_distance=best_dist_algo,
        best_algorithm_by_delivered=best_deliv_algo
    )
